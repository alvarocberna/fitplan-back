# Manejo de errores (backend)

Cómo maneja los errores `nutricionista-virtual-back` (estado al 2026-10-03). El lado del frontend está en
`nutricionista-virtual-front/doc/error-handling.md`, y el manejo de errores a nivel de flujo de compra (estados
de la orden, qué ve el usuario, procedimiento manual ante un `ERROR` definitivo) en
`../doc/flows/purchase-flow-personalized-plan.md` §7.

## 1. Mapa general

Hay dos contextos con reglas distintas:

- **Dentro de una request HTTP**: los casos de uso **lanzan** y nadie atrapa. No hay `try/catch` en
  controllers ni en casos de uso con endpoint. Toda excepción —del tipo que sea— termina en
  `AllExceptionsFilter`, que arma una respuesta con un formato único.
- **Fuera de una request** (listeners de eventos, jobs programados, generación del plan): no hay filtro que
  responda por nadie, así que cada punto de entrada **contiene** sus errores con `try/catch` / `.catch()`, los
  loguea con su stack y deja el estado en la base para que un job lo retome.

```
request ─ requestId ─ helmet ─ CORS ─ guards ─ pipes ─ controller ─ caso de uso ─ repositorio ─ Prisma
                          401/503/404 ┘      └ 400                └ throw (HttpException, Error, Prisma, LLM…)
                                                                           │
                                                AllExceptionsFilter ── { statusCode, code, message, errors?,
                                                                         requestId, timestamp, path }
```

| Mecanismo | Dónde | Para qué |
|---|---|---|
| `AllExceptionsFilter` | `src/common/filters/all-exceptions.filter.ts` | Formato único de respuesta para toda excepción |
| `ErrorCode` | `src/common/errors/error-codes.ts` | Códigos estables del contrato (`code`) |
| `configureApp` | `src/app.setup.ts` | Prefijo, request id, `ValidationPipe` y filtro; lo usan `main.ts` y el e2e |
| `requestIdMiddleware` | `src/common/middleware/request-id.middleware.ts` | Id de correlación por request |
| `ValidationPipe` global | `src/app.setup.ts` | Body inválido → 400 `VALIDATION_ERROR` |
| `ParseUUIDPipe` | controllers con `:id` | Id que no es UUID v4 → 400 |
| `CognitoAuthGuard` | `src/common/auth/cognito-auth.guard.ts` | 401 (token) o 503 (Cognito inalcanzable) |
| `PaymentSimulationEnabledGuard` | `src/modules/billing/` | Simulador deshabilitado → 404 |
| Excepciones HTTP de Nest | casos de uso | Errores de negocio (400/401/404/409), con `code` propio si hace falta |
| Errores de dominio | `src/domain/errors/` | Fallos de un puerto (`LlmUnavailableError`, …), sin NestJS |
| `AlertNotifier` | `src/domain/ports/alert-notifier.ts` | Aviso de algo que requiere intervención humana |
| `try/catch` + `Logger` | jobs, listeners, generación | Contener errores fuera de una request |

## 2. Contrato de error

Toda respuesta de error de la API tiene esta forma, sin excepción:

```json
{
  "statusCode": 400,
  "code": "VALIDATION_ERROR",
  "message": "Los datos enviados no son válidos",
  "errors": ["property inventada should not exist", "orderId must be a UUID"],
  "requestId": "4cd243ef-dc56-4722-9687-66565f3d1aa0",
  "timestamp": "2026-10-03T23:31:11.496Z",
  "path": "/api/v1/payments/webpay/commit"
}
```

- **`message`** es siempre un **string en español** apto para mostrar al usuario. Nunca un arreglo.
- **`code`** es estable: el frontend decide por `code` / `statusCode`, nunca comparando el texto de `message`.
- **`errors`** (opcional) lleva el detalle técnico: los mensajes de `class-validator`, o el texto original en
  inglés de un pipe o del router de Nest. Es para depurar, no para mostrar.
- **`requestId`** es el id de correlación (ver §8); también vuelve en el header `x-request-id`.
- El detalle de un error no controlado (mensaje, stack, SQL) **nunca** viaja en la respuesta, en ningún
  ambiente: queda solo en el log. Ya no existe el campo `exception` que antes se agregaba fuera de producción.

### Códigos

| `code` | Status | Cuándo |
|---|---|---|
| `VALIDATION_ERROR` | 400 | El body no pasa el `ValidationPipe` (detalle en `errors`) |
| `BAD_REQUEST` | 400 | Otro 400: regla de negocio que cruza campos, id que no es UUID, JSON malformado |
| `PROFILE_INCOMPLETE` | 400 | `POST /consultations` con el perfil incompleto |
| `GOAL_NOT_FEASIBLE` | 400 | `POST /consultations` con un objetivo no factible |
| `UNAUTHENTICATED` | 401 | Falta el token, o es inválido o expiró |
| `IDENTITY_NOT_SYNCED` | 401 | Token válido pero sin identidad registrada (`POST /me/sync` pendiente) |
| `FORBIDDEN` | 403 | Por defecto de un 403 |
| `EMAIL_NOT_VERIFIED` | 403 | `POST /me/sync` de una cuenta cuyo correo no está verificado en Cognito |
| `NOT_FOUND` | 404 | Recurso inexistente o ajeno (R2), catálogo no disponible, ruta inexistente; Prisma `P2025` |
| `CONFLICT` | 409 | Prisma `P2002` (unicidad) o `P2003` (llave foránea) |
| `ORDER_EXPIRED` | 409 | Iniciar un pago, pagar o rechazar una orden cuyo plazo venció |
| `ORDER_ALREADY_PAID` | 409 | Iniciar un pago (`POST /orders/:id/payments`) de una orden ya pagada |
| `PAYLOAD_TOO_LARGE` | 413 | Body JSON sobre el tope (300 kB) |
| `RATE_LIMITED` | 429 | Se superó el límite de frecuencia del endpoint (`common/throttling/`) |
| `LLM_UNAVAILABLE` | 503 | El proveedor del modelo no respondió o respondió algo inutilizable |
| `AUTH_UNAVAILABLE` | 503 | No se pudo verificar el token contra Cognito (red, JWKS) ni consultar `userInfo` |
| `PAYMENT_UNAVAILABLE` | 503 | Transbank no respondió o rechazó la llamada (`PaymentGatewayUnavailableError`) |
| `DATABASE_UNAVAILABLE` | 503 | No se pudo hablar con la base de datos |
| `SERVICE_UNAVAILABLE` | 503 | Por defecto de un 503 sin `code` propio |
| `INTERNAL_ERROR` | 500 | Cualquier error no previsto |

Para dar un `code` específico, el caso de uso pasa un objeto a la excepción de Nest:

```ts
throw new ConflictException({ code: ErrorCode.ORDER_EXPIRED, message: 'La orden expiró sin pagarse' });
```

Si solo pasa un string (`new NotFoundException('Consulta no encontrada')`), el `code` se deriva del status
(`errorCodeFromStatus`).

## 3. `AllExceptionsFilter`

Decorado con `@Catch()` (sin argumentos): atrapa **todo**. Se registra en `configureApp`. Resuelve cada
excepción a `{ statusCode, code, message, errors? }`:

| Excepción | Respuesta |
|---|---|
| `HttpException` | Su status. `code` y `message` de su cuerpo si los trae; si `message` es un arreglo pasa a `errors`. Los textos en inglés del framework (`Cannot GET …`, `Validation failed (uuid…)`, `Not Found`, JSON malformado) pasan a `errors` y `message` usa el texto por defecto del status |
| `Prisma.PrismaClientKnownRequestError` | `P2002` → 409 `CONFLICT` · `P2003` → 409 `CONFLICT` · `P2025` → 404 `NOT_FOUND` · `P1001`/`P1002`/`P1008`/`P1017`/`P2024` → 503 `DATABASE_UNAVAILABLE` · otro → 500 |
| `PrismaClientInitializationError`, `PrismaClientRustPanicError` | 503 `DATABASE_UNAVAILABLE` |
| `LlmUnavailableError`, `LlmInvalidResponseError` | 503 `LLM_UNAVAILABLE` |
| Cualquier otra cosa (incluido algo lanzado que no es un `Error`) | 500 `INTERNAL_ERROR`, `Ocurrió un error inesperado. Intenta nuevamente.` |

Nivel de log, siempre con `requestId`, método y ruta:

- **`error` con stack**: todo 5xx, y todo lo que no sea `HttpException` aunque se responda 4xx (un error de
  Prisma que llega hasta el filtro es una carrera o un bug: se registra con `prismaCode` y `prismaMeta`).
- **`debug`**: 401 y 404, que son tráfico normal (sesión vencida, ids ajenos).
- **`warn` sin stack**: el resto de los 4xx.

## 4. Entrada: validación y guards

**`ValidationPipe`** global (`whitelist`, `forbidNonWhitelisted`, `transform`, `enableImplicitConversion`) con
un `exceptionFactory` que responde `400 VALIDATION_ERROR`, `message: 'Los datos enviados no son válidos'` y los
mensajes de `class-validator` aplanados en `errors` (los de objetos anidados llevan el prefijo de su ruta).
Los DTO validados son las clases `*Impl` de `modules/<m>/dto/`.

**`ParseUUIDPipe({ version: '4' })`** en todos los parámetros `:id` → 400 antes de tocar la base.

Las reglas que cruzan campos viven en el caso de uso o en un helper
(`modules/clinical/measurement-input.ts` · `assertValidMeasurementInput`) y lanzan `BadRequestException` con
mensaje en español.

**`CognitoAuthGuard`** distingue tres situaciones:

| Situación | Respuesta |
|---|---|
| Sin `Authorization: Bearer` | 401 `Falta el token de autenticación` |
| El token no pasa la verificación (firma, expiración, audiencia: un `JwtBaseError` de `aws-jwt-verify`) | 401 `Token inválido o expirado` |
| No se pudieron obtener las claves de Cognito (`FetchError`, `JwksValidationError`) u otro fallo inesperado | log `error` con stack + 503 `AUTH_UNAVAILABLE` |

`getCognitoVerifier()` se llama **fuera** del `try`: una configuración faltante no se disfraza de 401. Además
`main.ts` lo invoca al arrancar, así que si faltan `COGNITO_USER_POOL_ID` / `COGNITO_CLIENT_ID` el proceso no
levanta.

**`PaymentSimulationEnabledGuard`**: `ENABLE_PAYMENT_SIMULATION !== 'true'` → 404, como si la ruta no existiera.
**Retorno de Webpay** (`POST /payments/webpay/commit`): no tiene guard; un token desconocido responde 404 y un
fallo de Transbank 503 `PAYMENT_UNAVAILABLE`. Un pago rechazado o anulado **no** es un error: responde 200 con
su `outcome`.

## 5. Convenciones de negocio

Reglas R1–R7 de `../doc/product/use-cases.md`:

- **R2 — 404 para "no existe" y "no es tuyo"**: los casos de uso con id filtran también por el usuario del
  token y responden el mismo 404, para no revelar la existencia de recursos ajenos.
- **Resultados que no son errores**: `POST /consultations/goal-feasibility` responde siempre `200` con
  `{ feasible, goal, message }`; un pago repetido responde `200 { status: 'already_processed' }`.
- **Invariantes → `Error` plano (500 `INTERNAL_ERROR`)**: situaciones que solo ocurren por mala configuración
  o datos inconsistentes y que el cliente no puede corregir: falta el producto `GENERATED` activo, un producto
  `PREDEFINED` sin `pdfKey`, un `AuthIdentity` que apunta a un `User` inexistente. El detalle queda en el log.

## 6. Persistencia (Prisma)

El código sigue **evitando** que los errores ocurran, y ahora el filtro traduce los que igual lleguen (§3):

- **Lectura antes de escribir.** `findUnique`/`findFirst` devuelven `null`; el caso de uso decide
  (`NotFoundException`).
- **Transiciones de estado con `updateMany` condicional** + `count`: `markOrderAsPaidWithPayment`,
  `expireOrderIfDue`, `tryTransitionOrderToGenerating`, … `count === 0` no es un error: significa "otro ya lo
  hizo" y es la base de la idempotencia del pago, de la expiración y del guard contra generaciones concurrentes.
- **Transacciones (`prisma.$transaction`)** para escrituras que deben ser atómicas (pago + `payment`, edición
  de una medición con sus tablas hijas, borrado de la consulta expirada).
- **`findOrCreate` atómicos.** `findOrCreateUserByEmail`, `findOrCreateClinicalRecordByPatientId` y
  `findOrCreateAuthIdentity` son un `upsert` con `update: {}`; si aun así pierden una carrera (`P2002`,
  detectado con `isUniqueConstraintError` de `orm/prisma/prisma-errors.ts`) releen la fila. Dos
  `POST /me/sync` simultáneos del mismo usuario terminan con una sola identidad y ambos responden 200.
- **Escrituras deliberadamente no atómicas.** `CreateConsultationUseCase` crea la orden y luego la consulta
  en dos operaciones: si la segunda falla responde 500 y queda una orden `PENDING` huérfana, cuyo id nunca llegó
  al cliente y que expira sola a las 24 h.
- **`parsePlanJson`** (`domain/services/utils/plan-json.ts`): `order.plan_json` corrupto se trata como "sin
  plan" (`null`) en `GetOrderStatusUseCase` y en `my-plan.mapper.ts`, en vez de romper la lectura.

`PrismaService` conecta en `onModuleInit` (`$connect`): si la base no está disponible el proceso no arranca.

## 7. Adaptadores externos

| Adaptador | Manejo |
|---|---|
| `OpenaiLlmProvider` | Cliente con `timeout` (`OPENAI_TIMEOUT_MS`, por defecto 60 s) y `maxRetries: 2` explícitos: es el tope de las llamadas dentro de una request (chat, factibilidad). Una llamada puede declarar sus propios límites (`LlmCallOptions`): la generación del plan, que tarda minutos, usa 5 min (`OPENAI_PLAN_TIMEOUT_MS`) y `maxRetries: 0`, porque ya reintenta su propio bucle. Todo error del SDK (red, timeout, 429, 4xx/5xx) → `LlmUnavailableError` (con el status en el mensaje, para el log). Respuesta vacía, que no es JSON, que no cumple el esquema pedido (`LlmCallOptions.schema`: structured output en modo estricto, validado además en el adaptador), cortada por límite de tokens (`finish_reason: 'length'`) o rechazada por el modelo (`refusal`) → `LlmInvalidResponseError`, con hasta 5 errores de esquema en el mensaje |
| `S3FileStorage` | `maxAttempts: 3`, timeout de conexión 5 s y de respuesta 30 s. `getOrThrow` de la configuración en el constructor (falla al arrancar si falta). Los errores se propagan |
| `ThumbnailService` | `try/finally` para liberar el documento de pdfjs. Se propaga; el llamador decide si es fatal |
| `LogEmailSender` | Stub: solo loguea |
| `LogAlertNotifier` | Log estructurado con contexto `ALERT` (`error` si es `critical`, `warn` si es `warning`) |

Los errores del LLM son clases de `domain/errors/` (sin NestJS): el adaptador no conoce HTTP y el caso de uso no
conoce a OpenAI. En una request terminan en `503 LLM_UNAVAILABLE` con un mensaje para el usuario; en la
generación del plan consumen un intento.

Tolerancia a respuestas defectuosas del modelo, que **no** son errores: `ChatAnamnesisUseCase` reintenta una
vez un `reply` vacío y si persiste usa un mensaje de resguardo; `EvaluateGoalFeasibilityUseCase` trata un
objetivo desconocido como `mantencion`.

## 8. Correlación y logging

`requestIdMiddleware` asigna a cada request un id: el del header `x-request-id` si viene con forma válida
(8–64 caracteres `[A-Za-z0-9._-]`; el frontend manda uno por llamada) o un UUID nuevo. Queda en
`req.requestId`, vuelve en el header de la respuesta, en el body de todo error y en su línea de log. Con ese id
se cruza el log del servidor de Next (`[action] backend 503 … (requestId …)`) con el del backend.

`Logger` de Nest con el nombre de la clase como contexto, a stdout.

| Nivel | Uso |
|---|---|
| `error` | 5xx y errores no HTTP de una request (filtro); fallos contenidos en jobs y listeners, **con stack**; ronda de generación agotada; Cognito inalcanzable; alertas `critical` |
| `warn` | 4xx (salvo 401/404); intento de generación fallido; miniatura, composición de base o correo no disponibles; alertas `warning` |
| `debug` | 401 y 404 |
| `log` | transiciones normales (pago confirmado, orden expirada, plan generado, correo simulado) |

## 9. Generación del plan (`GeneratePersonalizedPlanUseCase`)

Corre en segundo plano y su contrato es no producir nunca una promesa rechazada.

1. **Guard de estado**: `tryStartGeneration` solo avanza si la orden estaba `NOT_STARTED` o `ERROR`.
2. **Carga de datos** (orden, consulta, armado del DTO) dentro de un `try`: si falla, la ronda se da por
   fallida ahí mismo (`failRound`). La orden no queda pegada en `GENERATING`.
3. **Intentos**: hasta `MAX_ATTEMPTS = 4` con backoff exponencial (1 s, 2 s, 4 s). Cada intento cubre el LLM,
   la validación de porciones, el PDF, S3, la persistencia del plan y el cierre de la orden. Los intentos
   posteriores al primero renuevan `generationUpdatedAt` (`touchGeneration`) para que el job no confunda una
   generación que avanza con una interrumpida.
   - **Reintento dirigido**: si la validación (`collectPlanIssues`, que junta todos los problemas por tiempo de
     comida) rechaza algo, se le pide al modelo corregir **solo** esos tiempos (`llm_repair`), hasta
     `MAX_REPAIRS = 2` veces por intento. Recién si quedan problemas se lanza `PlanValidationError` y el intento
     falla. También falla sin corregir si la cantidad de tiempos de comida no coincide o si la corrección no trae
     exactamente los índices pedidos.
   - Un `LlmInvalidResponseError` (p. ej. respuesta que no cumple el esquema) o un `LlmUnavailableError` en
     cualquiera de las llamadas consume el intento, igual que antes.
4. **Correo fuera del intento**: `sendPlanEmail` corre después de `completeGeneration` con su propio
   `try/catch`. Un fallo (o un usuario sin email) deja un `warn` y una alerta `plan_email_failed`; **no**
   regenera el plan ni toca el estado de la orden, que ya está `COMPLETED`.
5. **`failRound`**: `recordFailedAttempt` (orden en `ERROR`, `attempts + 1`) protegido por su propio `catch`, y
   luego la alerta. Si ni siquiera se puede registrar el fallo, la orden queda en `GENERATING` y la libera el job.
6. **Pasos *best-effort*** (no consumen un intento): la miniatura y la composición corporal de base.

Los 4 intentos son una **ronda**. `RetryPendingGenerationsUseCase` relanza hasta 3 rondas más (esperas de
15 min / 1 h / 4 h), además de las órdenes pegadas en `GENERATING` por 30+ min y las pagadas que nunca
arrancaron; con `attempts = 4` el `ERROR` es definitivo. Mientras queden rondas, las lecturas informan
`GENERATING` en vez de `ERROR`. Constantes en `domain/services/orders/generation-retry.policy.ts`.

### Tiempos por fase

Con `PLAN_GENERATION_TIMING_LOGS=true` cada ronda queda instrumentada: una línea de log por fase, un resumen `plan_generation_attempt` por intento y un
`plan_generation_round` por ronda (también cuando la ronda falla, con la fase donde se cortó marcada `ok: false`).
Sirve para saber si un fallo fue lento (timeout del modelo) o rápido (validación, base). La tabla de fases y el
formato están en el README, sección "Tiempos de la generación".

### Alertas (`AlertNotifier`)

Puerto en `domain/ports/alert-notifier.ts`: `notify({ event, severity, message, context })`. Nunca lanza.

| `event` | `severity` | Cuándo |
|---|---|---|
| `plan_generation_failed` | `warning` | Falló una ronda y quedan reintentos automáticos |
| `plan_generation_failed` | `critical` | Falló la última ronda: `ERROR` definitivo, requiere intervención manual |
| `plan_email_failed` | `warning` | El plan está listo pero el correo no se pudo enviar |

Hoy el único adaptador es `LogAlertNotifier` (`infrastructure/alerts/`), que deja un log estructurado con el
contexto `ALERT`: se puede enganchar una alarma sobre los logs filtrando por ese contexto y
`severity: critical`. Conectar un canal real (correo con SES, Slack) es agregar otro adaptador del mismo puerto.

## 10. Eventos y jobs

Los eventos (`order.paid`, `order.expired`) viven en memoria: si el proceso se reinicia, se pierden. Por eso
cada listener tiene un job que revisa el estado en la base como red de seguridad.

| Punto de entrada | Contención | Red de seguridad |
|---|---|---|
| `OrderPaidListener` | *fire-and-forget* con `.catch()` → `logger.error` + stack | `RetryPendingGenerationsJob` |
| `OrderExpiredListener` | *fire-and-forget* con `.catch()` → `logger.error` + stack | `PurgeExpiredConsultationsJob` |
| `ExpireUnpaidOrdersJob` (cada 10 min) | `try/catch` → `logger.error` + stack | la siguiente corrida; además `isExpired` expira al leer o pagar |
| `RetryPendingGenerationsJob` (cada 10 min) | `try/catch/finally`, con bandera `running` para no solapar corridas | la siguiente corrida |
| `PurgeExpiredConsultationsJob` (cada hora) | `try/catch` → `logger.error` + stack | la siguiente corrida |

Dentro de cada caso de uso por lotes el bucle tiene su propio `try/catch` **por elemento**: una orden que falla
se loguea y no frena a las demás.

## 11. Arranque y proceso (`main.ts`)

- `bootstrap().catch` → log con stack + `process.exit(1)`.
- `unhandledRejection` → log `error` con stack (no corta el proceso: es la red bajo los puntos de entrada en
  segundo plano, que ya contienen sus errores).
- `uncaughtException` → log + `process.exit(1)`: tras una excepción no capturada el estado del proceso no es
  confiable y debe reiniciarlo el orquestador.
- `app.enableShutdownHooks()`: ante `SIGTERM`/`SIGINT` corre `onModuleDestroy` (`PrismaService.$disconnect`).
- Fallan al arrancar: la conexión a la base, la configuración de S3, la de Cognito, la API key de OpenAI y, en
  producción, `URL_FRONTEND`.

El script `src/scripts/seed-predefined-products.ts` tiene su propio manejo: `main().catch` → `console.error` +
`process.exit(1)`; `objectExists` trata solo el 404 de S3 como "no existe" y propaga cualquier otro error.

## 12. Tests

Detalle en `doc/testing.md`.

- `all-exceptions.filter.spec.ts`: formato, `HttpException` (string, objeto, arreglo, `code` propio, textos del
  framework), Prisma (`P2002`, `P2003`, `P2025`, conexión), LLM, error desconocido y niveles de log.
- `cognito-auth.guard.spec.ts`: token válido, sin token, token inválido (401), Cognito inalcanzable (503) y
  configuración faltante.
- `request-id.middleware.spec.ts`, `plan-json.spec.ts`, `openai-llm.provider.spec.ts` (traducción de errores).
- `generate-personalized-plan.use-case.spec.ts`: correo que falla sin regenerar, usuario sin email, fallo
  previo al bucle, fallo al registrar la ronda, severidad de la alerta.
- Specs de jobs y listeners: el error queda contenido y se loguea con stack.
- `test/app.e2e-spec.ts` (usa el mismo `configureApp` que `main.ts`): contrato completo de 401, 400 de
  validación, 400 de UUID, 404 de ruta inexistente, 500 sin fuga de detalle, `P2002` → 409, LLM → 503,
  `ORDER_EXPIRED`, y el `x-request-id` de ida y vuelta.

## 13. Cómo manejar un error nuevo

1. **Error de negocio en una request**: lanza la excepción de Nest que corresponda con un mensaje en español.
   Si el frontend necesita distinguirlo, agrega el código a `ErrorCode` y pásalo:
   `new ConflictException({ code: ErrorCode.X, message: '…' })`. No atrapes nada en el controller.
2. **Fallo de un servicio externo**: el adaptador lo traduce a una clase de `domain/errors/` y
   `AllExceptionsFilter` la mapea a su status y `code`. Los casos de uso no importan excepciones de un SDK.
3. **Invariante rota / mala configuración**: `throw new Error('detalle para el log')`. El cliente recibe un 500
   genérico y el detalle queda en el log con su `requestId`.
4. **Fuera de una request** (job, listener): `try/catch` en el punto de entrada, `logger.error(mensaje, stack)`
   y un estado en la base que permita reintentar. Si requiere que alguien intervenga, `AlertNotifier.notify`.
5. Agrega el caso al spec correspondiente y, si cambia el contrato, a `test/app.e2e-spec.ts` y al backend
   falso del frontend (`e2e/fake-backend/server.mjs`).

## 14. Pendiente

- **Canal real de alertas**: `LogAlertNotifier` solo deja un log. Falta un adaptador que avise a alguien
  (previsto: Amazon SES, ver `../doc/flows/purchase-flow-personalized-plan.md` §9).
- **Servicio de reporte de errores** (Sentry o similar): se decidió no integrarlo por ahora; la correlación se
  hace con `requestId` sobre los logs.
- **Mensajes de `class-validator` en inglés**: van en `errors` (no se muestran al usuario). Si algún día se
  quieren mostrar por campo, hay que darles mensajes en español en los DTO.
- **Eventos en memoria**: `order.paid` / `order.expired` siguen sin persistirse; los jobs cubren la pérdida,
  con una demora de minutos.
