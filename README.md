# NutriApp Back

Backend en [NestJS](https://nestjs.com/) para NutriApp: un agente conversacional que, apoyado en OpenAI,
recopila la anamnesis de un paciente por chat, procesa el pago de la consulta y genera de forma
asíncrona un plan nutricional personalizado (enviado por correo en PDF y descargable desde el frontend).

> Para el recorrido end-to-end de una consulta exitosa, con el orden exacto en que se usan los
> endpoints, ver **[flow-happy-path.md](./doc/flow-happy-path.md)**.

> Estado actual: el proyecto cubre el flujo completo **anamnesis (chat) → creación de orden → pago
> (simulado) → generación del plan con IA en background → consulta de estado/plan → envío por
> correo (stub)**. La persistencia (Prisma + **Postgres**) está conectada para el dominio comercial
> completo (`User`, `ClinicalRecord`, `NutritionalConsultation`/`Anamnesis`/`Measurements`,
> `Order`, `Product`) — ver [Base de datos](#base-de-datos-prisma) y
> [doc/orders-postgres-migration.md](./doc/orders-postgres-migration.md). No hay todavía módulo de
> autenticación/login real conectado (el `User` se resuelve por email vía find-or-create, sin
> credenciales).

## Índice

- [Stack](#stack)
- [Arquitectura](#arquitectura)
- [Puesta en marcha](#puesta-en-marcha)
- [Variables de entorno](#variables-de-entorno)
- [Módulos y endpoints](#módulos-y-endpoints)
  - [`POST /consulta/chat`](#post-consultachat)
  - [`POST /ordenes/crear`](#post-ordenescrear)
  - [`GET /ordenes/obtener-estado/:id`](#get-ordenesobtener-estadoid)
  - [`POST /webhooks/pago` y `POST /webhooks/ordenes/:id/simular-pago`](#post-webhookspago-y-post-webhooksordenesidsimular-pago)
  - [Generación del plan (background)](#generación-del-plan-background)
- [Capa de dominio](#capa-de-dominio)
  - [Fórmulas de requerimientos energéticos](#fórmulas-de-requerimientos-energéticos)
  - [Porciones de alimentos](#porciones-de-alimentos)
- [Integración con OpenAI](#integración-con-openai)
- [PDF y notificaciones](#pdf-y-notificaciones)
- [Manejo de errores](#manejo-de-errores)
- [Base de datos (Prisma)](#base-de-datos-prisma)
- [Testing](#testing)
- [Deuda técnica y pendientes](#deuda-técnica-y-pendientes)

## Stack

- **Framework**: NestJS 11 (Express)
- **Lenguaje**: TypeScript
- **IA**: SDK oficial de [`openai`](https://www.npmjs.com/package/openai) (chat completions, `response_format: json_object`)
- **Validación**: `class-validator` + `class-transformer` (`ValidationPipe` global en `main.ts`)
- **Configuración**: `@nestjs/config` (`.env`)
- **ORM**: Prisma + PostgreSQL, usado para todo el dominio comercial/clínico/identidad en producción
- **PDF**: `@react-pdf/renderer` (corre tanto server-side como client-side)
- **Jobs programados**: `cron` (job de retención de datos)
- **Testing**: Jest (`.spec.ts` unitarios) + Supertest (e2e)

## Arquitectura

El código sigue una separación por capas dentro de `src/`:

```
src/
├── domain/                # Reglas de negocio puras, sin dependencias de NestJS
│   ├── dtos/               # Interfaces de datos compartidas (Anamnesis, Consulta, Plan, Orden)
│   └── services/
│       ├── formulas/       # TMB, GET, requerimientos, composición corporal, somatocarta, suplementos...
│       ├── alimentos/      # Tabla de porciones de intercambio de alimentos
│       └── utils/          # Utilidades (cálculo de edad, etc.)
│
├── infrastructure/
│   ├── orm/prisma/         # PrismaService/PrismaModule (PostgreSQL)
│   ├── datasources/        # Implementaciones *Impl con Prisma del dominio Postgres (identity-auth,
│   │                       # clinical-domain, commercial-domain) — ver doc/postgres-domain-groundwork.md
│   └── repositories/       # *RepositoryImpl que delegan 1:1 en el datasource de su misma entidad
│
├── presentation/           # Módulos NestJS (controllers, services, DTOs con validación)
│   ├── consultation/       # Chat conversacional de recopilación de la anamnesis
│   ├── orders/             # Creación/consulta de la orden de cobro + job de retención de datos
│   ├── webhooks/           # Webhook de pago (real y simulado) → dispara la generación del plan
│   ├── plan-generation/    # Worker que genera el plan con IA (disparado por el webhook de pago)
│   ├── pdf/                # Generación del PDF del plan (@react-pdf/renderer)
│   ├── notifications/      # Envío del plan por correo (stub, con el PDF adjunto)
│   ├── openai/             # Cliente/wrapper del SDK de OpenAI, compartido por los módulos anteriores
│   └── filters/            # ExceptionFilter global
│
├── app.module.ts
└── main.ts
```

> Nota de nomenclatura: las rutas HTTP y varios nombres de campo JSON siguen deliberadamente en
> español (`/consulta/chat`, `/ordenes/crear`, valores como `'pendiente'`/`'pagado'`), aunque las
> carpetas, clases y la mayoría de campos internos ya están en inglés (`ConsultationService`,
> `OrdersService`, `PlanGenerationService`, `orderId`, `paymentStatus`, etc.) — ver `CLAUDE.md`.

`domain/` no importa nada de `presentation/` (dependencia en un solo sentido); los DTOs de `presentation`
(los `*Impl`, con decoradores de `class-validator`) implementan las interfaces definidas en `domain/dtos`.

### Módulos activos en `AppModule`

`PrismaModule`, `ConsultationModule`, `OpenaiModule`, los módulos de infraestructura del dominio
Postgres (`IdentityAuthDatasourcesModule`/`IdentityAuthRepositoriesModule`,
`ClinicalDomainDatasourcesModule`/`ClinicalDomainRepositoriesModule`,
`CommercialDomainDatasourcesModule`/`CommercialDomainRepositoriesModule` — ver
[Base de datos](#base-de-datos-prisma)), `OrdersModule` y `WebhooksModule` (este último importa
`PlanGenerationModule`, que a su vez importa `NotificationsModule` → `PdfModule`). En conjunto forman
la cadena: pago confirmado → generación del plan → PDF → correo. `OrdersModule` importa los tres
`*RepositoriesModule` para poder inyectar los repositories que usa `OrdersService`.

## Puesta en marcha

```bash
npm install
cp .env.template .env   # y completar los valores, incluyendo OPENAI_API_KEY y DATABASE_URL (Postgres)
npx prisma migrate dev  # aplica las migraciones sobre la base Postgres apuntada por DATABASE_URL
npm run start:dev
```

Scripts principales (`package.json`):

| Script | Descripción |
|---|---|
| `npm run start:dev` | Levanta el servidor en modo watch |
| `npm run start:prod` | Ejecuta el build (`dist/main`) |
| `npm run build` | Compila con `nest build` |
| `npm run lint` | ESLint con `--fix` |
| `npm run format` | Prettier sobre `src/` y `test/` |
| `npm run test` / `test:watch` / `test:cov` | Unit tests con Jest |
| `npm run test:e2e` | Tests e2e |

## Variables de entorno

Definidas en `.env.template`:

| Variable | Uso |
|---|---|
| `PORT` | Puerto HTTP (`main.ts`, default `3001`) |
| `URL_FRONTEND` | Origen permitido por CORS (`app.enableCors` en `main.ts`) |
| `EMAIL` | Correo de contacto/soporte referenciado en la config (no consumido aún por `EmailService`, que hoy es un stub) |
| `DATABASE_URL` | Cadena de conexión PostgreSQL para Prisma (ej. `postgresql://user:pass@localhost:5432/db`) |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` / `JWT_ACCESS_EXPIRATION` / `JWT_REFRESH_EXPIRATION` | Heredadas de un módulo de auth que ya no está presente en `src/` |
| `BCRYPT_SALT_OR_ROUNDS` | Idem, sin uso actual |
| `NODE_ENV` | Controla si `HttpExceptionFilter` incluye detalle del error en la respuesta |

Adicionalmente, `OpenaiService` (`src/presentation/openai/openai.service.ts`) recibe el modelo y la
temperature por parámetro en cada llamada a `chatJson`; cada caller resuelve su propio valor leyendo
`process.env` (con fallback si no está seteada):

- `OPENAI_API_KEY` (**requerida**, no está en `.env.template`)
- `OPENAI_MODEL` (opcional, default `gpt-4o-mini`; fallback interno de `chatJson` si un caller no pasa
  `model` explícito)
- `OPENAI_MODEL_CONSULTA` (opcional, default `gpt-4o-mini`; modelo usado por `POST /consulta/chat`
  -`consulta.service.ts`-, endpoint público sin pago de por medio, priorizando costo bajo)
- `OPENAI_MODEL_PLAN` (opcional, default `gpt-5-mini`; modelo usado por la generación del plan
  -`generacion-plan.service.ts`-, disparada solo tras el pago de una orden. No se le fija `temperature`:
  este modelo solo soporta su valor default, 1 -la API devuelve 400 con cualquier otro valor-)

## Módulos y endpoints

Ver también [flow-happy-path.md](./doc/flow-happy-path.md) para el orden real en que el frontend consume
estos endpoints dentro de una consulta completa.

### `POST /consulta/chat`

Maneja el chat entre el paciente y la IA para completar la ficha de anamnesis. Se llama una vez por
cada turno de la conversación.

- **Controller**: `ConsultaController` → `ConsultaService.chat`
- **Request** (`InputChatDtoImpl`):
  ```ts
  {
    messages: { role: 'user' | 'assistant'; content: string }[],
    anamnesis?: AnamnesisDto   // estado parcial acumulado de turnos anteriores
  }
  ```
- **Response** (`OutputChatDtoImpl`):
  ```ts
  {
    reply: string,          // mensaje de la IA para el paciente
    titleReply: string,     // título corto que resume el tema del turno (para UI)
    anamnesis: AnamnesisDto, // anamnesis fusionada (estado previo + info nueva)
    isComplete: boolean,    // true cuando todos los campos obligatorios están completos
  }
  ```

Lógica de `ConsultaService.chat`:

1. Construye un **system prompt** (`buildSystemPrompt`) que instruye a OpenAI a actuar como
   nutricionista deportivo, define el esquema JSON de `AnamnesisDto` (objetivos, clínica,
   alimentaria/r24h/preferencias/estrategia deportiva, estilo de vida), el orden estricto de
   recopilación por secciones y las reglas de completitud. Incluye el estado actual de la anamnesis
   para que el modelo sepa qué falta.
2. Llama a `OpenaiService.chatJson` con ese prompt + el historial de `messages`.
3. Si `reply` vuelve vacío, reintenta una vez antes de usar un mensaje de resguardo (`fallbackReply`),
   para no propagar una respuesta vacía al historial del chat. Lo mismo aplica a `titleReply`
   (`fallbackTitleReply`).
4. Normaliza el `anamnesis` devuelto por el LLM con `normalizeAnamnesisPayload`
   (`presentation/consulta/dto/anamnesis-normalizer.ts`), que repara desvíos de forma típicos de un
   LLM (objetos anidados donde se esperan planos, tipos incorrectos, claves desconocidas) — en
   particular el caso de `r24h`, que debe ser un array de objetos **planos** por comida.
5. Recalcula `isComplete` en el servidor (`meetsCompletionRules`) en vez de confiar ciegamente en lo
   que devuelve el modelo, verificando que los campos obligatorios (objetivo principal, patología,
   alergias, intolerancias, fármacos, al menos un `r24h`, estrategia deportiva, nivel de actividad
   física, al menos un deporte y las sesiones deportivas con sus 7 campos completos) tengan valor.

### `POST /ordenes/crear`

Crea la orden de cobro **antes** de que el usuario pague, con toda la información recopilada hasta
ese punto (información personal + anamnesis + mediciones). La IA de generación del plan no se ejecuta
en este paso.

- **Controller**: `OrdersController.create` → `OrdersService.createOrder`
- **Request** (`CompleteConsultationDtoImpl`): `personalInfo`, `anamnesis`, `measurements` (por ahora
  solo `weight`/`height`; el resto de mediciones antropométricas —pliegues, perímetros, diámetros—
  están definidas en `domain/dtos` pero comentadas/sin usar todavía).
- **Response**: `{ orderId: string }`
- Ya **no** persiste un payload JSON crudo: resuelve/crea el `User` por email
  (`findOrCreateUserByEmail`), su `ClinicalRecord` (`findOrCreateClinicalRecordByPatientId`) y el
  `Product` activo tipo `GENERATED` (`findOrCreateActiveGeneratedProduct`), crea la `Order`
  (`paymentStatus='pendiente'`, `generationStatus='no_iniciado'`, `planJson=null`, `attempts=0`) y
  crea, en una sola operación atómica, el árbol completo `NutritionalConsultation` +
  `Anamnesis`/`Measurements` y sus hijas, vinculado a esa orden (`orderId`). Ver el detalle completo
  del mapeo en [doc/orders-postgres-migration.md](./doc/orders-postgres-migration.md). Requiere que
  el body incluya `personalInfo.email` (400 si falta).

### `GET /ordenes/obtener-estado/:id`

Endpoint de **polling** que consume el frontend desde la pantalla de resultado (`/ordenes/[id]`) para
saber si el plan ya está listo.

- **Controller**: `OrdersController.getStatus` → `OrdersService.getStatus`
- **Response** (`OrderStatusDto`, sin el árbol de la consulta ni datos del usuario — es información
  interna del pipeline):
  ```ts
  {
    paymentStatus: 'pendiente' | 'pagado',
    generationStatus: 'no_iniciado' | 'generando' | 'completado' | 'error',
    planJson: NutritionPlanDto | null,
  }
  ```
- 404 (`NotFoundException`) si el `id` no corresponde a ninguna orden.

### `POST /webhooks/pago` y `POST /webhooks/ordenes/:id/simular-pago`

Ambos endpoints ejecutan exactamente la misma lógica (`WebhooksService.processPayment`); la diferencia
es quién los llama:

- **`POST /webhooks/pago`** (`WebhookPagoDtoImpl { orden_id: string }` — este campo del body es de los
  pocos que sigue en español): pensado para ser invocado por una pasarela de pago real (Mercado Pago,
  Flow, Stripe, etc.). Antes de procesar, valida la firma del webhook vía
  `WebhooksService.verifyWebhookSignature()` — **hoy siempre devuelve `true`** porque no hay ninguna
  pasarela integrada aún; ese es el punto de extensión donde se validará la firma/secreto real.
- **`POST /webhooks/ordenes/:id/simular-pago`**: sin body, usado hoy por el frontend
  (`/pago/[ordenId]`) como sustituto de una pasarela real mientras no exista una integrada.

Lógica de `WebhooksService.processPayment(orderId)`:

1. Busca la orden (404 si no existe).
2. Marca `paymentStatus: 'pendiente' → 'pagado'` de forma **idempotente**: si ya estaba pagada, no la
   reprocesa y responde `{ status: 'ya_procesado' }`.
3. Si la marcó recién, dispara `PlanGenerationService.generatePlan(orderId)` **fire-and-forget** (sin
   `await`) y responde de inmediato `{ status: 'procesado' }` — el webhook no espera a que el plan
   termine de generarse.

### Generación del plan (background)

No es un endpoint HTTP: es un proceso asíncrono (`PlanGenerationService.generatePlan`, en
`presentation/plan-generation/`) disparado por `WebhooksService.processPayment` una vez confirmado el
pago. Ver el detalle paso a paso en
[flow-happy-path.md § Generación del plan](./doc/flow-happy-path.md#7-generación-del-plan-proceso-en-segundo-plano-sin-request-http-del-frontend).

Resumen:

1. Guard de estado (evita generar el plan dos veces ante disparos concurrentes).
2. **`extraerInfoPromp`**: le pide a OpenAI (`EXTRAER_INFO_SYSTEM_PROMPT`) que clasifique, a partir de
   la anamnesis, el `nivel_actividad_fisica` (1.4 sedentario / 1.5 moderado / 1.6 activo) y el
   `objetivo` (`definicion` | `mantencion` | `volumen`).
3. Calcula la edad (`calcularEdad`) y llama a `calculoRequerimientos` (ver
   [fórmulas](#fórmulas-de-requerimientos-energéticos)) y `calculoSuplementos`, ambos **sin IA**.
4. **`NUTRICIONISTA_SYSTEM_PROMPT`** (`generacion-plan.prompts.ts`) le pide a OpenAI que genere el plan
   (`PlanNutricionalGenerado`, es decir `PlanNutricionalDto` sin `informacion_personal`) usando
   **exactamente** los requerimientos ya calculados (no le permite recalcularlos), y expresando los
   alimentos de cada tiempo de comida en **porciones por grupo de intercambio** (ver
   [Porciones de alimentos](#porciones-de-alimentos)), no en alimentos/cantidades libres.
5. Arma el plan final combinando `informacion_personal` (calculada localmente a partir de los datos
   del `User` y de la `NutritionalConsultation` asociada a la orden — ver
   [doc/orders-postgres-migration.md § 7](./doc/orders-postgres-migration.md#7-srcpresentationplan-generationplan-generationservicets),
   que reemplazó al antiguo `payload_json`), el plan generado por la IA, y fuerza
   `prescripcion.objetivo` al valor calculado en el paso 2 (por si el modelo lo omite o lo cambia).
6. Reintenta hasta 4 veces con backoff exponencial ante cualquier error. Si tiene éxito, persiste el
   plan en la orden (`generationStatus='completado'`) y llama a `EmailService.sendPlanByEmail`. Si
   agota los reintentos, marca `generationStatus='error'` y registra el evento.

## Capa de dominio

### Fórmulas de requerimientos energéticos

`src/domain/services/formulas/requerimientos.service.ts`:

- **`tasaMetabolicaBasal` (TMB)**: Harris-Benedict (1919) para mayores de 18 años; FAO/OMS/UNU (1985) para
  menores (con corte adicional en 10 años), separado por sexo.
- **`gastoEnergeticoTotal` (GET)**: `TMB * (1 + (nivel_actividad_fisica - 1) + (CONSTANTE_TERMOGENESIS - 1))`,
  con `CONSTANTE_TERMOGENESIS = 1.1`.
- **`calculoRequerimientos`**: a partir del GET y el `objetivo`:
  - `energia`: GET − 500 (definición), GET + 200 (volumen), o GET (mantención).
  - `proteina`: `peso * 1.5` g.
  - `carbohidrato`: 50% de la energía (definición) o 55% (volumen/mantención), convertido a gramos (÷4).
  - `lipido`: el resto de la energía tras descontar proteína y carbohidrato, convertido a gramos (÷9).

`src/domain/services/formulas/suplementos.service.ts` calcula `calculoSuplementos(peso)`, una
prescripción de suplementos (ej. creatina, proteína) en función del peso del paciente, usada como
input fijo del prompt de generación del plan (igual que los requerimientos: la IA no la recalcula).

Otros servicios de fórmulas presentes en `domain/services/formulas/` (IMC, suma de pliegues, masa
muscular, % grasa corporal, phantom, IMM, perímetros corregidos, somatocarta, sesión deportiva)
implementan cálculos de evaluación antropométrica y deportiva clásicos en nutrición deportiva, pero
**aún no están conectados** al flujo de generación del plan (los `mediciones` que llegan hoy solo
traen peso y talla; `sesion-deportiva.service.ts` tiene la intención de calcular el gasto de cada
sesión de entrenamiento pero no está enchufado — ver `doc/technical-debt.md`).

### Porciones de alimentos

`src/domain/services/alimentos/porciones-alimentos.ts` define `PORCIONES_GRUPOS_ALIMENTOS`: una tabla de
intercambio de alimentos (cereales, verduras de libre/consumo general, frutas, proteínas alta/baja en
grasa, lácteos por nivel de grasa, ricos en lípidos, aceites/grasas, azúcares), cada uno con su aporte
nutricional por porción y una lista de alimentos de ejemplo con su porción y gramaje.

`generacion-plan.prompts.ts` usa esta tabla para decirle a la IA, por cada campo del objeto `alimentos`
de un tiempo de comida, el aporte por porción del grupo correspondiente y alimentos de ejemplo — así el
modelo calcula cuántas porciones de cada grupo corresponden y arma los `ejemplos` con alimentos reales.

## Integración con OpenAI

`OpenaiService` (`src/presentation/openai/openai.service.ts`) es un wrapper delgado sobre el SDK de
`openai`: expone `chatJson<T>(systemPrompt, messages, model?)`, que llama a
`chat.completions.create` con `response_format: { type: 'json_object' }`, hace `JSON.parse` del contenido
devuelto y lanza `InternalServerErrorException` si la respuesta viene vacía. Es el único punto de acceso a
OpenAI en todo el backend; se llama desde `ConsultaService` (chat de anamnesis) y desde
`GeneracionPlanService` (extracción de nivel de actividad/objetivo y generación del plan), cada uno con
sus propios prompts (`consulta.service.ts` y `generacion-plan.prompts.ts` respectivamente).

## PDF y notificaciones

- **`PdfModule` (`presentation/pdf/`)**: `PdfService.generarBuffer(plan)` renderiza
  `PlanNutricionalDocument` (definido con primitivas de `@react-pdf/renderer`) a un `Buffer` PDF. El
  mismo componente de documento se reutiliza en el frontend para la descarga client-side del plan, sin
  duplicar el layout.
- **`NotificationsModule` (`presentation/notifications/`)**: `EmailService.sendPlanByEmail(email,
  plan)` arma el asunto/cuerpo del correo, genera el PDF vía `PdfService` y llama a
  `sendRealEmail` — **hoy un stub** que solo deja un log estructurado; no hay proveedor de correo
  (SendGrid/SES/Resend/etc.) conectado todavía.

## Manejo de errores

`HttpExceptionFilter` (`src/presentation/filters/http-exception.filter.ts`) es un `ExceptionFilter` global
(registrado en `main.ts`) que captura toda `HttpException`, normaliza el `message` (venga como string,
array o `{ message | error }`), lo loguea con `Logger`, y responde `{ statusCode, message, timestamp,
path }`. Fuera de `NODE_ENV=production`, además incluye `exception: { name, response }` para depuración.

## Base de datos (Prisma)

`prisma/schema.prisma` corre sobre **PostgreSQL** y modela el dominio completo del producto
(identidad/auth, historial clínico, comercial) — 33 modelos en total, organizados en tres secciones
del schema: `IDENTITY & AUTH`, `CLINICAL DOMAIN`, `COMMERCIAL DOMAIN`. El flujo comercial descrito en
este README (`POST /ordenes/crear` → pago → generación del plan) persiste sobre este dominio real, no
sobre una tabla plana con un payload JSON crudo. Ver el detalle completo de la arquitectura de esta
capa (entidades, DTOs, datasources, repositories) en
**[doc/postgres-domain-groundwork.md](./doc/postgres-domain-groundwork.md)**, y el detalle de cómo se
conectó al flujo comercial en
**[doc/orders-postgres-migration.md](./doc/orders-postgres-migration.md)**.

Modelos que participan directamente en el flujo comercial hoy:

| Modelo | Rol |
|---|---|
| `User` (`identity-auth`) | Resuelto por `personalInfo.email` vía find-or-create (`UserRepository.findOrCreateUserByEmail`); no hay login/credenciales reales detrás |
| `ClinicalRecord` (`clinical-domain`) | Uno por paciente (`patientId` `@unique`), find-or-create |
| `NutritionalConsultation` (`clinical-domain`) | Una por cada `POST /ordenes/crear`; vinculada 1:1 a la `Order` vía `orderId`; contiene el árbol `Anamnesis`+hijas y `Measurements`+hija que antes viajaba como `payload_json` |
| `Product` (`commercial-domain`) | Producto `type='GENERATED' active=true`, find-or-create con valores placeholder (ver deuda técnica) |
| `Order` (`commercial-domain`) | Reemplaza al modelo `Order` legacy de SQLite (ya no existe en el schema); ver campos abajo |

Campos relevantes de `Order` (tabla `order`):

| Campo | Uso |
|---|---|
| `id` | UUID, generado en `OrdersService.createOrder` |
| `userId` / `productId` | FKs a `User` y `Product` |
| `amount` / `currency` | Copiados de `Product` al crear la orden |
| `paymentStatus` | `'pendiente'` \| `'pagado'` |
| `generationStatus` | `'no_iniciado'` \| `'generando'` \| `'completado'` \| `'error'` |
| `planJson` | `NutritionPlanDto` resultante serializado, `null` hasta que se genera |
| `attempts` | Contador de intentos fallidos de generación |
| `nutritionalConsultation` | Relación inversa 1:1 hacia la `NutritionalConsultation` con los datos de la anamnesis/mediciones de esta orden |

No hay todavía módulo de autenticación/login real conectado a ningún endpoint (el `User` se resuelve
solo por email, sin credenciales) — ver `doc/orders-postgres-migration.md` y `doc/technical-debt.md`.
Buena parte del resto del dominio (`AuthIdentity`, `Payment`, `NutritionalPlan` y sus hijas, la
mayoría de `clinical-domain` fuera de lo que usa la consulta nutricional básica) sigue sin ningún
consumidor real — no asumir que "todo" el dominio Postgres está conectado.

Un job de retención (`RetentionService`, cron diario a las 03:00) anonimiza `Order.planJson` (lo pone
en `null`) de órdenes con más de 45 días, conservando la fila para auditoría/estadística — ver
`OrdersService.cleanupOldOrders`. **No** anonimiza todavía los datos clínicos de la
`NutritionalConsultation`/`Anamnesis`/`Measurements` asociada (ver deuda técnica).

## Testing

Cada módulo de `presentation` trae sus `.spec.ts` (controller y service) junto al archivo que testean.
Comandos: `npm run test` (unitarios), `npm run test:e2e`, `npm run test:cov`.

## Deuda técnica y pendientes

Ver también `doc/technical-debt.md`, `doc/postgres-domain-groundwork.md` y
`doc/orders-postgres-migration.md` (deuda específica de la conexión del dominio Postgres al flujo
comercial) y `to-do-list.md` (esta última describe deuda de una versión anterior con capa de
datasources/repositories que ya no existe en el código actual).

- Las fórmulas de TMB usadas son una aproximación con precisión de 3 decimales; la diferencia frente a
  fórmulas más exactas es mínima (~5 cal) pero convendría validarlas contra fuentes confiables.
- No se está calculando el gasto energético de cada sesión de entrenamiento individual — existe la
  intención (`sesion-deportiva.service.ts`, mencionado en `technical-debt.md`) pero no está conectada al
  flujo de generación del plan, lo que limita las recomendaciones deportivas a algo genérico por ahora.
- Solo `weight` y `height` de `MeasurementsDto` están activos; el resto de mediciones antropométricas (y los
  servicios de fórmulas que las usan: composición corporal, somatocarta, etc.) están definidas pero no
  conectadas al flujo de generación del plan.
- No hay pasarela de pago real integrada (`WebhooksService.verifyWebhookSignature` siempre devuelve
  `true`) ni proveedor de correo real conectado (`EmailService.sendRealEmail` es un stub que solo
  logea).
- No hay módulo de autenticación/login real conectado a los endpoints actuales — el `User` (Postgres)
  se resuelve solo por email vía find-or-create, sin credenciales ni sesión.
- `notifyGenerationFailure` (cuando la generación del plan agota sus reintentos) solo deja un log
  estructurado; falta integrarlo con un canal de alertas/soporte real.
- El `Product` que usa hoy el flujo comercial (`findOrCreateActiveGeneratedProduct`) tiene su precio y
  moneda **hardcodeados como placeholder** (`price: 19990`, `currency: 'CLP'`) — no hay pricing real
  ni negociación comercial; revisar con negocio antes de producción (ver
  `doc/orders-postgres-migration.md`).
- El mapeo de `CompleteConsultationDto` hacia el árbol `NutritionalConsultation`/`Anamnesis`/`Measurements`
  tiene varias simplificaciones conocidas (campos clínicos singulares envueltos en arrays de 1,
  `mealHour` siempre `''`, `somatotype` guardado como texto libre en `Measurements.description`,
  `AnamnesisPsychosocial`/`Supplements` sin poblar) — ver `doc/orders-postgres-migration.md § 12` y
  `doc/technical-debt.md` para el detalle completo.
- El job de retención solo anonimiza `Order.planJson`; los datos clínicos de la
  `NutritionalConsultation` asociada a órdenes antiguas no se anonimizan todavía.
