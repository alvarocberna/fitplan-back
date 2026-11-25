# Fitplan Back

Backend en [NestJS](https://nestjs.com/) para Fitplan: un agente conversacional que, apoyado en OpenAI,
recopila la anamnesis de un paciente por chat, procesa el pago de la consulta y genera de forma
asíncrona un plan nutricional personalizado (enviado por correo en PDF y descargable desde el frontend).

> Para el recorrido end-to-end de una consulta exitosa, con el orden exacto en que se usan los
> endpoints, ver **[purchase-flow-personalized-plan.md](../doc/flows/purchase-flow-personalized-plan.md)**.

## Stack

- **Framework**: NestJS 11 (Express)
- **Lenguaje**: TypeScript
- **IA**: SDK oficial de [`openai`](https://www.npmjs.com/package/openai) (chat completions; *structured output* con `response_format: json_schema` en la generación del plan y las clasificaciones, `json_object` en el chat)
- **Validación**: `class-validator` + `class-transformer` (`ValidationPipe` global en `main.ts`)
- **Documentación de API**: `@nestjs/swagger` (Swagger UI en `/api-docs`, ver [Puesta en marcha](#puesta-en-marcha))
- **Configuración**: `@nestjs/config` (`.env`)
- **ORM**: Prisma + PostgreSQL, usado para todo el dominio comercial/clínico/identidad en producción
- **PDF**: `@react-pdf/renderer` (corre tanto server-side como client-side)
- **Almacenamiento**: AWS SDK v3 (`@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner`) para
  persistir el PDF de cada plan en un bucket S3 privado y servirlo vía URL firmada
- **Autenticación**: Amazon Cognito (`aws-jwt-verify` valida el Access Token)
- **Pagos**: Webpay Plus de Transbank (`transbank-sdk`)
- **Eventos**: `@nestjs/event-emitter` (v3; ver [Problemas conocidos](#problemas-conocidos))
- **Testing**: Jest (`.spec.ts` unitarios) + Supertest (e2e) + Testcontainers (integración con Postgres)

## Requisitos previos

- Node.js 22
- Docker, para la base de datos local (`../fitplan-db`) y los tests de integración
- Una API key de OpenAI
- Un User Pool de Cognito y un bucket S3 para probar el flujo completo (ver
  [Variables de entorno](#variables-de-entorno))

## Puesta en marcha

```bash
cd ../fitplan-db && docker compose up -d && cd -   # Postgres en :5432 (Adminer en :8080)
npm install
cp .env.template .env   # y completar los valores; agregar OPENAI_API_KEY, que no está en la plantilla
npx prisma migrate dev  # aplica las migraciones sobre la base de DATABASE_URL
npm run start:dev       # API en http://localhost:3001/api/v1
```

Con `ENABLE_SWAGGER=true` en el `.env` (y fuera de `NODE_ENV=production`), la documentación interactiva de la
API queda disponible en `GET /api-docs` (Swagger UI) y su schema OpenAPI crudo en `GET /api-docs-json`. Es
opt-in: sin esa variable no se monta, para que no quede expuesta por un `NODE_ENV` sin setear. Los tipos de los DTOs
que aparecen en el schema se infieren de las clases `class-validator` de `modules/**/dto` gracias al CLI plugin de
`@nestjs/swagger` (`nest-cli.json`), así que no se anotan a mano con `@ApiProperty`.

Scripts principales (`package.json`):

| Script | Descripción |
|---|---|
| `npm run start:dev` | Levanta el servidor en modo watch |
| `npm run start:prod` | Ejecuta el build (`dist/main`) |
| `npm run build` | Compila con `nest build` |
| `npm run lint` / `lint:check` | ESLint con `--fix` / sin `--fix` (el que usa el CI) |
| `npm run format` | Prettier sobre `src/` y `test/` |
| `npm run test` / `test:watch` / `test:cov` | Unit tests con Jest |
| `npm run test:e2e` | Tests e2e (sin base de datos real) |
| `npm run test:integration` | Datasources y migraciones sobre un Postgres desechable (necesita Docker) |
| `npm run seed:predefined` | Carga y activa las versiones de los planes estándar |
| `npm run openapi:export` | Exporta el schema OpenAPI (lo usa el frontend como contrato de sus e2e) |
| `npx prisma generate` | Regenera el cliente de Prisma en `generated/prisma` |

## Variables de entorno

Definidas en `.env.template`:

| Variable | Uso |
|---|---|
| `PORT` | Puerto HTTP (`main.ts`, default `3001`) |
| `URL_FRONTEND` | Único origen permitido por CORS. **Obligatoria en producción** (sin ella el proceso no arranca) |
| `TRANSBANK_ENVIRONMENT` | `integration` (ambiente de pruebas de Transbank, por defecto) o `production` |
| `TRANSBANK_COMMERCE_CODE` / `TRANSBANK_API_KEY` | Credenciales del comercio en Webpay Plus. En `integration`, sin ellas se usan las públicas de prueba del SDK; en `production` son **obligatorias** (sin ellas el proceso no arranca) |
| `WEBPAY_RETURN_URL` | URL del frontend a la que Webpay devuelve al usuario (`<front>/api/webpay/return`). Por defecto `http://localhost:3000/api/webpay/return`; **obligatoria en producción** |
| `ENABLE_SWAGGER` | `true` monta Swagger en `/api-docs` (nunca en producción) |
| `DATABASE_URL` | Cadena de conexión PostgreSQL para Prisma (ej. `postgresql://user:pass@localhost:5432/db`) |
| `NODE_ENV` | `production` impide montar Swagger y exige `URL_FRONTEND` |
| `OPENAI_TIMEOUT_MS` | Opcional. Tope de las llamadas al modelo dentro de una request: chat y factibilidad (por defecto 60000) |
| `OPENAI_PLAN_TIMEOUT_MS` | Opcional. Tope de la llamada que genera el plan, que tarda minutos (por defecto 300000) |
| `PLAN_GENERATION_TIMING_LOGS` | `true` muestra en el log los tiempos por fase de la generación del plan. Apagado por defecto |
| `ENABLE_PAYMENT_SIMULATION` | `true` habilita `POST /api/v1/dev/orders/:id/simulate-payment[-rejection]` (con cualquier otro valor responden 404). Solo para desarrollo y pruebas: marca la orden sin pasar por Webpay. **En producción va en `false`** |
| `COGNITO_USER_POOL_ID` / `COGNITO_CLIENT_ID` | User Pool y App Client con los que se valida el Access Token (ver [doc-back/auth.md](https://github.com/alvarocberna/fitplan/blob/main/doc/doc-back/auth.md)) |
| `AWS_REGION` / `AWS_S3_BUCKET_NAME` / `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | Bucket S3 de los PDFs (`S3FileStorage`) |

Adicionalmente, `OpenaiLlmProvider` (`src/infrastructure/llm/openai/openai-llm.provider.ts`) recibe el
modelo y la temperature por parámetro en cada llamada a `chatJson`; cada caso de uso resuelve su propio
valor leyendo `process.env` (con fallback si no está seteada):

- `OPENAI_API_KEY` (**requerida**, no está en `.env.template`)
- `OPENAI_MODEL` (opcional, default `gpt-4o-mini`; fallback interno de `chatJson` si un caller no pasa
  `model` explícito)
- `OPENAI_MODEL_CONSULTA` (opcional, default `gpt-4o-mini`; modelo del chat de anamnesis,
  `ChatAnamnesisUseCase`, sin pago de por medio, priorizando costo bajo)
- `OPENAI_MODEL_PLAN` (opcional, default `gpt-5-mini`; modelo de la generación del plan,
  `GeneratePersonalizedPlanUseCase`, disparada solo tras el pago. No se le fija `temperature`: este
  modelo solo soporta su valor default, 1 -la API devuelve 400 con cualquier otro valor-)

## Arquitectura

La estructura sigue [`../doc/product/refactor.md`](../doc/product/refactor.md) y la lógica de aplicación
está partida en casos de uso según [`../doc/product/use-cases.md`](../doc/product/use-cases.md):

```
src/
├── domain/                 # Reglas de negocio puras, sin dependencias de NestJS
│   ├── ports/              # Clases abstractas hacia sistemas externos: LlmProvider, FileStorage,
│   │                       # EmailSender, PlanDocumentRenderer, AlertNotifier, IdentityProvider,
│   │                       # PaymentGateway (Nest las usa como token de inyección)
│   ├── dtos/ entities/     # Interfaces de datos y entidades (espejo de prisma/schema.prisma)
│   ├── datasources/ repositories/  # Contratos de persistencia por entidad
│   └── services/
│       ├── formulas/       # TMB, GET, requerimientos, composición corporal, somatocarta, suplementos...
│       ├── alimentos/      # Tabla de porciones de intercambio de alimentos
│       └── utils/          # Edad, códigos de planes estándar, keys de S3 (storage-keys.ts)
│
├── infrastructure/         # Adaptadores (implementan los puertos y los repositorios)
│   ├── persistence/        # orm/prisma, datasources/ y repositories/ (Prisma + PostgreSQL)
│   ├── llm/openai/         # OpenaiLlmProvider (LlmProvider)
│   ├── payments/transbank/ # TransbankPaymentGateway (PaymentGateway, Webpay Plus)
│   ├── storage/s3/         # S3FileStorage (FileStorage)
│   ├── email/              # LogEmailSender (EmailSender, hoy un stub que solo loguea)
│   ├── alerts/             # LogAlertNotifier (AlertNotifier, hoy un stub que solo loguea)
│   ├── pdf/                # ReactPdfPlanDocumentRenderer (PlanDocumentRenderer): PDF + miniatura
│   └── auth/cognito/       # Verificador del Access Token de Cognito (aws-jwt-verify)
│
├── common/                 # Transversal: CognitoAuthGuard, @CognitoUser(), AllExceptionsFilter, ErrorCode, requestId, API_PREFIX
│
├── modules/                # Módulos NestJS: controllers + casos de uso + DTOs validados
│   ├── identity/           # /me, /me/sync, /me/summary + CurrentUserResolver (exportado)
│   ├── consultation/       # chat de anamnesis + crear consulta (con su orden); borra la consulta al expirar su orden (listener de order.expired)
│   ├── plans/              # catálogo estándar, mis planes, generación del plan (listener de order.paid)
│   ├── billing/            # ciclo de vida de la orden, pagos con Webpay Plus (inicio, retorno, confirmado/rechazado), job de expiración; emite order.paid y order.expired
│   └── clinical/           # historial clínico: /me/consultations y /me/measurements
│
├── app.module.ts
└── main.ts                 # app.setGlobalPrefix('api/v1')
```

Cada módulo sigue la convención de `use-cases.md`: `<recurso>.controller.ts` (HTTP ↔ caso de uso),
`dto/`, `use-cases/<verbo>-<recurso>.use-case.ts` (una clase con un único `execute`) y, si reacciona a
eventos, `listeners/`. Los tests (`*.spec.ts`) van junto al archivo que prueban.

Reglas de dependencia:

- `domain/` no importa nada de `modules/`, `infrastructure/` ni `common/`. Los casos de uso dependen de
  los puertos (`domain/ports`), nunca de OpenAI/S3/etc. directamente.
- Entre módulos: `consultation`/`plans` → `billing` → nada, y todos → `identity` (solo para
  `CurrentUserResolver`). `billing` avisa del pago confirmado emitiendo el evento `order.paid`
  (`@nestjs/event-emitter`); `plans` lo escucha para generar el plan, así `billing` no depende de `plans`.
  Igual con la expiración de una orden sin pagar: `billing` emite `order.expired` y `consultation` lo
  escucha para borrar la consulta de esa orden.
- Solo `billing` escribe `order`/`payment`: la creación de órdenes pasa por `CreateOrderUseCase` y las
  transiciones de generación por `OrderLifecycleService` (ambos exportados).

Todas las rutas cuelgan de **`/api/v1`** (Swagger queda fuera, en `/api-docs`). Las rutas son
sustantivos en inglés y plural; lo que pertenece al usuario autenticado vive bajo `/me` (el usuario sale
siempre del token, nunca de un id externo). Los estados de la orden son enums en inglés
(`PENDING`/`PAID`/`REJECTED`/`EXPIRED`, `NOT_STARTED`/`GENERATING`/`COMPLETED`/`ERROR`).

### Módulos en `AppModule`

`ConfigModule`, `EventEmitterModule`, `PrismaModule` (global) y los cinco módulos de negocio:
`IdentityModule`, `ConsultationModule`, `PlansModule`, `BillingModule` y `ClinicalModule`. Cada módulo importa los
módulos de repositorios (`*RepositoriesModule`) y de adaptadores (`LlmModule`, `FileStorageModule`,
`EmailModule`, `PlanDocumentRendererModule`) que necesita. La cadena del plan personalizado es:
`POST /consultations` (consultation + `CreateOrderUseCase` de billing) → pago confirmado
(`ConfirmPaymentUseCase`, billing) → evento `order.paid` → `OrderPaidListener` (plans) →
`GeneratePersonalizedPlanUseCase` → PDF → S3 → correo.


## Módulos y endpoints

Todas las rutas llevan el prefijo `/api/v1` (se omite abajo). Las que dicen "sesión" exigen
`Authorization: Bearer <access_token de Cognito>` (`CognitoAuthGuard`) y resuelven el usuario con
`CurrentUserResolver.resolve` (R1 de use-cases.md). El detalle de cada caso de uso (flujo, errores,
salida) está en [`../doc/product/use-cases.md`](../doc/product/use-cases.md); el orden en que el frontend
los consume, en [purchase-flow-personalized-plan.md](../doc/flows/purchase-flow-personalized-plan.md).

| Método | Ruta | Sesión | Caso de uso | Módulo |
|---|---|---|---|---|
| POST | `/me/sync` | Sí | `SyncIdentityUseCase` | identity |
| GET | `/me` | Sí | `GetMyProfileUseCase` | identity |
| PATCH | `/me` | Sí | `UpdateMyProfileUseCase` | identity |
| GET | `/me/summary` | Sí | `GetMySummaryUseCase` | identity |
| POST | `/consultations/chat` | Sí | `ChatAnamnesisUseCase` | consultation |
| POST | `/consultations/goal-feasibility` | Sí | `EvaluateGoalFeasibilityUseCase` | consultation |
| POST | `/consultations` | Sí | `CreateConsultationUseCase` | consultation |
| GET | `/plans/standard/previews` | No | `ListStandardPlanPreviewsUseCase` | plans |
| GET | `/plans/standard/:code` | No | `GetStandardPlanUseCase` | plans |
| GET | `/plans/personalized` | No | `GetPersonalizedPlanUseCase` | plans |
| POST | `/plans/standard/:code/purchase` | Sí | `PurchaseStandardPlanUseCase` | plans |
| GET | `/me/plans` | Sí | `ListMyPlansUseCase` | plans |
| GET | `/me/plans/latest/projection` | Sí | `GetMyLatestPlanProjectionUseCase` | plans |
| GET | `/me/plans/:orderId` | Sí | `GetMyPlanUseCase` | plans |
| GET | `/me/consultations` | Sí | `ListMyConsultationsUseCase` | clinical |
| GET | `/me/consultations/:consultationId` | Sí | `GetMyConsultationUseCase` | clinical |
| GET | `/me/measurements` | Sí | `ListMyMeasurementsUseCase` | clinical |
| GET | `/me/measurements/:measurementId` | Sí | `GetMyMeasurementUseCase` | clinical |
| POST | `/me/measurements` | Sí | `RecordMeasurementUseCase` | clinical |
| PATCH | `/me/measurements/:measurementId` | Sí | `UpdateMyMeasurementUseCase` | clinical |
| GET | `/orders/:id/status` | Sí | `GetOrderStatusUseCase` | billing |
| POST | `/orders/:id/payments` | Sí + dueño de la orden | `StartPaymentUseCase` | billing |
| POST | `/payments/webpay/commit` | No (token de la transacción de Webpay) | `CommitWebpayPaymentUseCase` | billing |
| POST | `/dev/orders/:id/simulate-payment` | Sí + dueño de la orden (`ENABLE_PAYMENT_SIMULATION`) | `ConfirmPaymentUseCase` | billing |
| POST | `/dev/orders/:id/simulate-payment-rejection` | Sí + dueño de la orden (`ENABLE_PAYMENT_SIMULATION`) | `RejectPaymentUseCase` | billing |

El comportamiento de cada endpoint (contratos de respuesta, estados, expiración de órdenes), la generación del plan
(reintentos e instrumentación), la capa de dominio, la integración con OpenAI y el PDF/S3 están en
**[doc-back/reference.md](../doc/doc-back/reference.md)**.

## Manejo de errores

`AllExceptionsFilter` (`src/common/filters/all-exceptions.filter.ts`, registrado en `src/app.setup.ts`) atrapa
**toda** excepción de una request —`HttpException`, errores de Prisma, del proveedor de LLM o inesperados— y
responde siempre con el mismo formato:

```json
{ "statusCode": 409, "code": "ORDER_EXPIRED", "message": "La orden expiró sin pagarse",
  "requestId": "…", "timestamp": "…", "path": "/api/v1/…" }
```

`message` es siempre un string en español para el usuario; `code` es estable (`src/common/errors/error-codes.ts`)
y es por lo que decide el frontend; `errors` (opcional) lleva el detalle técnico de una validación; `requestId`
es el id de correlación (`x-request-id`) que también queda en los logs. El detalle de un error no controlado
nunca viaja en la respuesta.

El resto (catálogo de códigos, guards, Prisma, adaptadores externos, jobs/listeners, generación del plan, alertas,
logging y arranque) está en [`doc-back/error-handling.md`](https://github.com/alvarocberna/fitplan/blob/main/doc/doc-back/error-handling.md).

## Seguridad

Los controles de seguridad del backend (autenticación, dueño del recurso, pagos, validación y topes de entrada,
rate limiting, CORS, modelo de lenguaje, S3, secretos, dependencias) están documentados en
[`../doc/security/backend-security.md`](../doc/security/backend-security.md); la matriz de vulnerabilidades de
toda la aplicación, en [`../doc/security/security.md`](../doc/security/security.md).

Rate limiting: `@nestjs/throttler` global, por (endpoint, usuario); los límites están en
`src/common/throttling/throttle-limits.ts`. Superado un límite la API responde 429 `RATE_LIMITED`.

## Base de datos (Prisma)

`prisma/schema.prisma` modela el dominio completo sobre **PostgreSQL** (35 modelos en tres secciones:
`IDENTITY & AUTH`, `CLINICAL DOMAIN`, `COMMERCIAL DOMAIN`), aunque solo una parte tiene consumidor hoy. Las columnas de
valores cerrados son enums nativos de Postgres, reflejados en `domain/entities/enums.ts`. Las migraciones son SQL
editable en `prisma/migrations/`.

El diagrama está en [`../doc/database/entity-relation-diagram.md`](../doc/database/entity-relation-diagram.md), y qué
modelos usa cada flujo (y los campos de `Order`), en
[doc-back/reference.md](../doc/doc-back/reference.md#base-de-datos-prisma).

## Testing

Cada controller, caso de uso, adaptador y servicio de `domain/services` trae su(s) `.spec.ts`
co-localizado(s) junto al archivo que testea. Comandos: `npm run test` (unitarios), `npm run test:e2e`
(sin base de datos real), `npm run test:integration` (Postgres desechable con Testcontainers, necesita Docker) y
`npm run test:cov`. Para correr un solo archivo: `npm test -- confirm-payment.use-case` (Jest usa `src/` como
`rootDir`). Ver **[doc-back/testing.md](https://github.com/alvarocberna/fitplan/blob/main/doc/doc-back/testing.md)** para el detalle de qué cubre cada test, las
decisiones de infraestructura (stub de `@react-pdf/renderer`), y la deuda pendiente.

## Despliegue y CI

- **Despliegue**: imagen Docker (`Dockerfile`) en una instancia de AWS Lightsail, junto a PostgreSQL. Las
  migraciones se aplican con `npx prisma migrate deploy`. Paso a paso en
  [`../doc/architecture/deployment-guide.md`](../doc/architecture/deployment-guide.md).
- **CI**: GitHub Actions (`.github/workflows/ci.yml`) en cada PR y en cada push a `main` y `dev`: lint, tipos,
  tests unitarios y e2e, build, export de OpenAPI, integración con Postgres, build de la imagen Docker y
  `npm audit`. No necesita secretos. Ver [`../doc/architecture/ci.md`](../doc/architecture/ci.md).

## Problemas conocidos

- **`npx prisma generate` falla con `EPERM` en Windows**: el backend en ejecución bloquea el motor de consultas.
  Detén el backend y vuelve a correrlo (el cliente TypeScript se regenera igual).
- **No actualizar `@nestjs/event-emitter` más allá de v3**: v12 es solo ESM y Jest (CJS) no puede cargarlo.
- **`npm ci` falla con npm 10 (Docker)**: `chokidar` es una devDependency explícita a propósito para evitarlo; no
  la quites.
- **El frontend rechaza requests en sus e2e tras cambiar una ruta o un DTO de entrada**: corre
  `npm run openapi:export` y commitea en el frontend el contrato regenerado.

## Contribuir

- Ramas desde `dev`, con PR hacia `dev`/`main`. El CI debe pasar.
- Commits con el formato `tipo(alcance): descripción` en español, p. ej. `fix(formulas): ...`, `update(doc): ...`.
- Un endpoint nuevo es un caso de uso nuevo (`modules/<m>/use-cases/<verbo>-<recurso>.use-case.ts`, con su
  `.spec.ts`) y se registra en [`../doc/product/use-cases.md`](../doc/product/use-cases.md). Las reglas de
  arquitectura completas están en `CLAUDE.md`.
- Un cambio en el contrato HTTP se despliega junto con `fitplan-front`.

## Deuda técnica y pendientes

Ver también `../doc/backlog/technical-debt.md` (incluye la deuda de la conexión del dominio Postgres al flujo
comercial). `to-do-list.md` está desactualizado: ignóralo.

Resumen de lo principal (detalle en [doc-back/reference.md](../doc/doc-back/reference.md#deuda-técnica-detalle)):

- El correo (`LogEmailSender`) y las alertas (`LogAlertNotifier`) son stubs que solo loguean. El proveedor de correo decidido es Amazon SES.
- Pagos: falta la validación de Transbank para producción, no hay reembolso automático y no hay un job que cierre los intentos abandonados.
- Solo se usan peso y talla de las mediciones: las demás fórmulas antropométricas no están conectadas a la generación del plan.
- Los PDFs de los planes estándar se suben a mano, y los precios de sus 112 versiones son placeholders.
- Una orden en `ERROR` definitivo requiere intervención manual en la base.
- Los datos de salud se conservan sin límite de tiempo: no hay política de retención.
