# NutriApp Back

Backend en [NestJS](https://nestjs.com/) para NutriApp: un agente conversacional que, apoyado en OpenAI,
recopila la anamnesis de un paciente por chat, procesa el pago de la consulta y genera de forma
asíncrona un plan nutricional personalizado (enviado por correo en PDF y descargable desde el frontend).

> Para el recorrido end-to-end de una consulta exitosa, con el orden exacto en que se usan los
> endpoints, ver **[flow-happy-path.md](./doc/flow-happy-path.md)**.

> Estado actual: el proyecto cubre el flujo completo **anamnesis (chat) → creación de orden → pago
> (simulado) → generación del plan con IA en background → consulta de estado/plan → envío por
> correo (stub)**, más la compra de planes estándar, el perfil (`GET`/`PATCH /me`) y un resumen para
> un panel del usuario (`GET /me/summary`). La persistencia (Prisma + **Postgres**) está conectada
> para el dominio comercial completo (`User`, `ClinicalRecord`,
> `NutritionalConsultation`/`Anamnesis`/`Measurements`, `Order`, `Product`) — ver
> [Base de datos](#base-de-datos-prisma) y
> [doc/orders-postgres-migration.md](./doc/orders-postgres-migration.md). La autenticación es real,
> vía Amazon Cognito (`modules/identity/`, `CognitoAuthGuard`) — ver **[doc/auth.md](./doc/auth.md)**
> — el `User` se resuelve por el `sub` del token validado, no por email suelto.

## Índice

- [Stack](#stack)
- [Arquitectura](#arquitectura)
- [Puesta en marcha](#puesta-en-marcha)
- [Variables de entorno](#variables-de-entorno)
- [Módulos y endpoints](#módulos-y-endpoints)
  - [identity: `/me`](#identity-me)
  - [consultation: `/consultations`](#consultation-consultations)
  - [plans: `/plans/standard` y `/me/plans`](#plans-plansstandard-y-meplans)
  - [billing: `/orders`, `/webhooks/payments` y `/dev/orders`](#billing-orders-webhookspayments-y-devorders)
  - [Generación del plan (background)](#generación-del-plan-background)
- [Capa de dominio](#capa-de-dominio)
  - [Fórmulas de requerimientos energéticos](#fórmulas-de-requerimientos-energéticos)
  - [Porciones de alimentos](#porciones-de-alimentos)
- [Integración con OpenAI](#integración-con-openai)
- [PDF y almacenamiento en S3](#pdf-y-almacenamiento-en-s3)
- [Manejo de errores](#manejo-de-errores)
- [Base de datos (Prisma)](#base-de-datos-prisma)
- [Testing](#testing)
- [Deuda técnica y pendientes](#deuda-técnica-y-pendientes)


## Stack

- **Framework**: NestJS 11 (Express)
- **Lenguaje**: TypeScript
- **IA**: SDK oficial de [`openai`](https://www.npmjs.com/package/openai) (chat completions, `response_format: json_object`)
- **Validación**: `class-validator` + `class-transformer` (`ValidationPipe` global en `main.ts`)
- **Documentación de API**: `@nestjs/swagger` (Swagger UI en `/api-docs`, ver [Puesta en marcha](#puesta-en-marcha))
- **Configuración**: `@nestjs/config` (`.env`)
- **ORM**: Prisma + PostgreSQL, usado para todo el dominio comercial/clínico/identidad en producción
- **PDF**: `@react-pdf/renderer` (corre tanto server-side como client-side)
- **Almacenamiento**: AWS SDK v3 (`@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner`) para
  persistir el PDF de cada plan en un bucket S3 privado y servirlo vía URL firmada
- **Testing**: Jest (`.spec.ts` unitarios) + Supertest (e2e)

## Arquitectura

La estructura sigue [`../doc/product/refactor.md`](../doc/product/refactor.md) y la lógica de aplicación
está partida en casos de uso según [`../doc/product/use-cases.md`](../doc/product/use-cases.md):

```
src/
├── domain/                 # Reglas de negocio puras, sin dependencias de NestJS
│   ├── ports/              # Clases abstractas hacia sistemas externos: LlmProvider, FileStorage,
│   │                       # EmailSender, PlanDocumentRenderer (Nest las usa como token de inyección)
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
│   ├── storage/s3/         # S3FileStorage (FileStorage)
│   ├── email/              # LogEmailSender (EmailSender, hoy un stub que solo loguea)
│   ├── pdf/                # ReactPdfPlanDocumentRenderer (PlanDocumentRenderer): PDF + miniatura
│   └── auth/cognito/       # Verificador del Access Token de Cognito (aws-jwt-verify)
│
├── common/                 # Transversal: CognitoAuthGuard, @CognitoUser(), HttpExceptionFilter, API_PREFIX
│
├── modules/                # Módulos NestJS: controllers + casos de uso + DTOs validados
│   ├── identity/           # /me, /me/sync, /me/summary + CurrentUserResolver (exportado)
│   ├── consultation/       # chat de anamnesis + crear consulta (con su orden)
│   ├── plans/              # catálogo estándar, mis planes, generación del plan (listener de order.paid)
│   ├── billing/            # ciclo de vida de la orden, pagos, webhooks; emite order.paid
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
- Solo `billing` escribe `order`/`payment`: la creación de órdenes pasa por `CreateOrderUseCase` y las
  transiciones de generación por `OrderLifecycleService` (ambos exportados).

Todas las rutas cuelgan de **`/api/v1`** (Swagger queda fuera, en `/api-docs`). Las rutas son
sustantivos en inglés y plural; lo que pertenece al usuario autenticado vive bajo `/me` (el usuario sale
siempre del token, nunca de un id externo). Los estados de la orden son enums en inglés
(`PENDING`/`PAID`, `NOT_STARTED`/`GENERATING`/`COMPLETED`/`ERROR`).

### Módulos en `AppModule`

`ConfigModule`, `EventEmitterModule`, `PrismaModule` (global) y los cuatro módulos de negocio:
`IdentityModule`, `ConsultationModule`, `PlansModule` y `BillingModule`. Cada módulo importa los
módulos de repositorios (`*RepositoriesModule`) y de adaptadores (`LlmModule`, `FileStorageModule`,
`EmailModule`, `PlanDocumentRendererModule`) que necesita. La cadena del plan personalizado es:
`POST /consultations` (consultation + `CreateOrderUseCase` de billing) → pago confirmado
(`ConfirmPaymentUseCase`, billing) → evento `order.paid` → `OrderPaidListener` (plans) →
`GeneratePersonalizedPlanUseCase` → PDF → S3 → correo.


## Puesta en marcha

```bash
npm install
cp .env.template .env   # y completar los valores, incluyendo OPENAI_API_KEY y DATABASE_URL (Postgres)
npx prisma migrate dev  # aplica las migraciones sobre la base Postgres apuntada por DATABASE_URL
npm run start:dev
```

Con el servidor corriendo (y fuera de `NODE_ENV=production`), la documentación interactiva de la API
queda disponible en `GET /api-docs` (Swagger UI) y su schema OpenAPI crudo en `GET /api-docs-json`
— montados condicionalmente en `main.ts` vía `SwaggerModule.setup('api-docs', app, document)`. Si
`NODE_ENV` no está seteado, igual se monta (pensado para estar siempre activo salvo que se
desactive explícitamente en producción). Los tipos de los DTOs que aparecen en el schema de Swagger
se infieren automáticamente a partir de las clases `class-validator` ya existentes en
`modules/**/dto` — no hace falta (ni se usa en este proyecto) anotarlas manualmente con
`@ApiProperty`, porque el CLI plugin de `@nestjs/swagger` está habilitado en `nest-cli.json`
(`compilerOptions.plugins: ["@nestjs/swagger"]`) y genera esos metadatos en tiempo de compilación.

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
| `EMAIL` | Correo de contacto/soporte referenciado en la config (no consumido aún por `EmailSender`, que hoy es un stub) |
| `DATABASE_URL` | Cadena de conexión PostgreSQL para Prisma (ej. `postgresql://user:pass@localhost:5432/db`) |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` / `JWT_ACCESS_EXPIRATION` / `JWT_REFRESH_EXPIRATION` | Heredadas de un módulo de auth que ya no está presente en `src/` |
| `BCRYPT_SALT_OR_ROUNDS` | Idem, sin uso actual |
| `NODE_ENV` | Controla si `HttpExceptionFilter` incluye detalle del error en la respuesta |
| `ENABLE_PAYMENT_SIMULATION` | `true` habilita `POST /api/v1/dev/orders/:id/simulate-payment` (con cualquier otro valor responde 404). Mientras no haya pasarela real es el único camino de pago, así que va en `true` también en producción |
| `COGNITO_USER_POOL_ID` / `COGNITO_CLIENT_ID` | User Pool y App Client con los que se valida el Access Token (ver [doc/auth.md](./doc/auth.md)) |
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


## Módulos y endpoints

Todas las rutas llevan el prefijo `/api/v1` (se omite abajo). Las que dicen "sesión" exigen
`Authorization: Bearer <access_token de Cognito>` (`CognitoAuthGuard`) y resuelven el usuario con
`CurrentUserResolver.resolve` (R1 de use-cases.md). El detalle de cada caso de uso (flujo, errores,
salida) está en [`../doc/product/use-cases.md`](../doc/product/use-cases.md); el orden en que el frontend
los consume, en [flow-happy-path.md](./doc/flow-happy-path.md).

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
| POST | `/webhooks/payments` | No (firma de la pasarela) | `ConfirmPaymentUseCase` | billing |
| POST | `/dev/orders/:id/simulate-payment` | No (`ENABLE_PAYMENT_SIMULATION`) | `ConfirmPaymentUseCase` | billing |

### identity: `/me`

- **`POST /me/sync`** (body `{ email }`): idempotente. La primera vez que ve el `sub` de Cognito crea
  `AuthIdentity` + un `User` "esqueleto" (solo email); después devuelve el existente. El frontend lo
  llama en el callback de login. Ver [doc/auth.md](./doc/auth.md).
- **`GET /me`** / **`PATCH /me`**: perfil del usuario. `PATCH` recibe un único
  `UpdateProfileDtoImpl` con **todos los campos opcionales** (`rut`, `rutCheckDigit`, `firstName`,
  `middleName`, `paternalLastName`, `maternalLastName`, `gender`, `dateOfBirth`, `athlete`) y solo
  actualiza los presentes (un campo en `null` se limpia). `email` y `photoUrl` no se editan por acá.
  Unifica los antiguos `PATCH /auth/perfil` y `PATCH /user/me`.
- Las tres responden el mismo `ProfileDto`:
  ```ts
  { email, rut, rutCheckDigit, firstName, middleName, paternalLastName, maternalLastName,
    gender, dateOfBirth, age, athlete, photoUrl, profileComplete }
  ```
  `profileComplete` = nombre, apellido paterno, género y fecha de nacimiento presentes
  (`CurrentUserResolver.isProfileComplete`), requisito para crear una consulta.
- **`GET /me/summary`** (`SummaryDto`): datos del panel. Toma la última `NutritionalConsultation` del
  paciente con plan generado
  (`NutritionalConsultationRepository.getLatestNutritionalConsultationWithDetailsByPatientId`) y
  devuelve nombre, edad (`calculateAge`), fecha de esa consulta, `goal` (`anamneses[0].goals[0].mainGoal`)
  y el `nutritionalPlan` principal del `plan` activo (solo los `*Intake` y `dietRegimen`, nunca los
  `*Requirement`). Además devuelve `lastMeasurement` (`{ measuredAt, weight, height, bmi,
  bmiClassification, bfPercentage }`): la medición de `measuredAt` más reciente del historial clínico,
  sea de consulta o registrada por el usuario
  (`MeasurementsRepository.getLatestMeasurementsWithResultsByPatientId`). `bmi`, su clasificación y
  `bfPercentage` salen solo de `measurement_results` (no se calculan al leer: los calcula
  `calculateMeasurementResults` al crear o editar la medición; `bfPercentage` solo existe en una
  bioimpedancia). Todo es null-safe: sin consulta, plan o medición, esos campos
  vuelven `null`.

### clinical: `/me/consultations`

- **`GET /me/consultations`** (`ListMyConsultationsUseCase`, CU-CLI-01): consultas del usuario del
  token, de la más reciente a la más antigua (`consultationDate`, luego `consultationNumber`), incluidas
  las no pagadas. Cada ítem (`ConsultationSummaryDto`):
  ```ts
  { consultationId, consultationNumber, consultationDate, mainGoal,
    planStatus: 'awaiting_payment' | 'generating' | 'ready' | 'error' | null, orderId,
    plan: { planName, goal, dietRegimen, calorieIntake, proteinIntake, carbohydrateIntake, lipidIntake } | null }
  ```
  `planStatus` se deriva de la orden (`generationStatus` COMPLETED → `ready`, ERROR → `error`; si no,
  `paymentStatus` PENDING → `awaiting_payment`, PAID → `generating`; sin orden → `null`). `plan` es el
  `NutritionalPlan` principal del `plan` activo. Sin consultas → `[]`. El módulo no importa `billing`:
  lee los estados de la orden vía include
  (`NutritionalConsultationRepository.getNutritionalConsultationsWithStatusByPatientId`).
- **`GET /me/consultations/:consultationId`** (`GetMyConsultationUseCase`, CU-CLI-02): detalle de solo
  lectura. Busca por (`id`, `patientId` del token) con
  `getNutritionalConsultationDetailByIdAndPatientId`; inexistente o ajena → **404** (R2), id que no es
  UUID v4 → 400. Devuelve `ConsultationDetailDto`:
  ```ts
  { consultationId, consultationNumber, consultationDate,
    goals: { mainGoal, secondaryGoals[] }, planStatus, orderId,
    measurements: { measurementId, measurementNumber, measuredAt, level,
      basic: { weight, height, sittingHeight, armSpan } | null,
      results: { bmi, bmiClassification, bfPercentage, bfClassification } | null }[],
    plan: { orderId, pdfUrl, planName, goal, dietRegimen, calorieIntake, proteinIntake, carbohydrateIntake, lipidIntake } | null }
  ```
  `plan.pdfUrl` es la URL firmada de descarga del PDF (R4, `signPlanFiles` de `billing/order-files.ts`,
  como attachment), o `null` si la orden todavía no tiene `pdfKey`. Las mediciones son solo las tomadas en la consulta (`consultation_id` = la consulta), nunca las
  registradas por el usuario. El DTO de medición es una versión reducida de `MeasurementDetailDto`
  (CU-CLI-04). `toPlanStatus` (`modules/clinical/plan-status.ts`) es compartido con el listado.

### clinical: `/me/measurements`

Mediciones del historial clínico del usuario del token (de consulta y registradas por él). Los mapeos
están en `modules/clinical/measurement.mapper.ts` y las reglas de entrada en `measurement-input.ts`.

- **`GET /me/measurements`** (`ListMyMeasurementsUseCase`, CU-CLI-03; query opcional `from`/`to`):
  `MeasurementSummaryDto[]` más reciente primero: `{ measurementId, measurementNumber, measuredAt, level,
  origin: 'CONSULTATION'|'SELF_REPORTED', consultationId, consultationNumber, weight, height, bmi,
  bmiClassification, bfKg, bfPercentage, mmKg, mmPercentage }`. `origin` se deriva de `consultation_id`.
- **`GET /me/measurements/:measurementId`** (`GetMyMeasurementUseCase`, CU-CLI-04): `MeasurementDetailDto`
  con `raw` (`basic`, `skinfolds`, `circumferences`, `diameters`: solo los valores presentes) y `results`
  (`{ indicator, value, unit, classification, method }` de los campos no nulos de `measurement_results`;
  sin `pha_*` ni rangos de referencia todavía). Inexistente o ajena → 404 (R2, filtra por
  `clinicalRecord.patientId` en la misma query).
- **`POST /me/measurements`** (`RecordMeasurementUseCase`, CU-CLI-05; `RecordMeasurementDtoImpl`):
  `{ level: 'BASIC'|'BIOIMPEDANCE', measuredAt?, weight (20-300), height (100-250), bodyFat?, muscleMass?,
  visceralFat?, boneMass? }` (cada componente = `{ value, unit: 'PERCENTAGE'|'KG' }`: un solo valor, en %
  **o** en kg. `bodyFat`/`muscleMass` obligatorios en bioimpedancia, `visceralFat`/`boneMass` opcionales, y
  los cuatro prohibidos en básica; fecha no futura; % 1-80; kg < peso → si no, 400). Hace find-or-create
  del `clinical_record`, asigna `measurement_number` = máximo del historial + 1 y crea la medición
  (`consultation_id = null`) con `basic_measurements` y `measurement_results` en una escritura.
  `measurement_results` lo calcula `calculateMeasurementResults`
  (`domain/services/measurements/measurement-results.calculator.ts`): siempre `bmi` + `bmi_classification`;
  en bioimpedancia, además `*_kg` y `*_percentage` de cada componente ingresado (el que falta se calcula
  con el peso, redondeado a 2 decimales) con `*_method = 'BIOIMPEDANCE'`; las clasificaciones de
  bf/mm/vf/bm quedan en `null` (pendientes). Responde 201 con el detalle.
- **`PATCH /me/measurements/:measurementId`** (`UpdateMyMeasurementUseCase`, CU-CLI-06;
  `UpdateMeasurementDtoImpl`, sin `level`): corrige fecha, peso, talla y, en bioimpedancia, los cuatro
  componentes (`visceralFat`/`boneMass: null` quita el guardado). **Se pueden editar todas las
  mediciones**, también las de una consulta. Valida y **recalcula `measurement_results`** con el resultado
  de combinar lo guardado con lo enviado: de lo no enviado se toma el **% guardado** (fuente de verdad),
  así que si cambia solo el peso se mantienen los % y se recalculan los kg y el IMC. Solo la fecha no
  recalcula nada. Actualiza padre + hijas en una transacción
  (`MeasurementsRepository.updateMeasurementWithDetails`).

La medición que crea `POST /consultations` (CU-CON-02) se guarda como `level = 'BASIC'` con su IMC en
`measurement_results`, calculado con la misma función. La migración
`20260928120000_backfill_measurement_results` completó lo mismo para las mediciones anteriores.

### consultation: `/consultations`

**`POST /consultations/chat`** (`ChatAnamnesisUseCase`): un turno del chat de anamnesis.

- **Request** (`InputChatDtoImpl`): `{ messages: { role, content }[], anamnesis?: AnamnesisDto }`.
- **Response** (`OutputChatDtoImpl`): `{ reply, titleReply, anamnesis, isComplete }`.
- Lógica:
  1. Construye el system prompt (`prompts/anamnesis-chat.prompt.ts`): rol de nutricionista deportivo,
     esquema JSON completo de `AnamnesisDto`, orden de recopilación por secciones, reglas de completitud
     y el estado actual de la anamnesis.
  2. Llama a `LlmProvider.chatJson`. Si `reply` vuelve vacío reintenta una vez antes de usar un mensaje
     de resguardo (igual con `titleReply`).
  3. Normaliza el `anamnesis` con `normalizeAnamnesisPayload` (`dto/anamnesis-normalizer.ts`), que
     repara desvíos típicos del LLM (por ejemplo, `r24h` debe ser un array de objetos planos por comida).
  4. Recalcula `isComplete` en el servidor en vez de confiar en el modelo (objetivo principal,
     patología, alergias, intolerancias, fármacos, al menos un `r24h`, estrategia deportiva, nivel de
     actividad física, al menos un deporte y sesiones deportivas con sus 7 campos).

**`POST /consultations/goal-feasibility`** (`EvaluateGoalFeasibilityUseCase`, CU-CON-03): el frontend lo
llama al terminar la evaluación física, antes de generar la orden.

- **Request** (`GoalFeasibilityRequestDtoImpl`): `goals` (el `GoalsDto` del chat, puede ser null) y
  `measurements: { weight, height }`. El sexo y el %GC salen del usuario del token (el %GC, de la medición
  más reciente del historial que lo tenga).
- **Response** (siempre 200): `{ feasible, goal: 'definicion'|'mantencion'|'volumen', message }`.
- Clasifica el objetivo con el LLM (`prompts/classify-goal.prompt.ts`, mismo criterio que
  `extract-info.prompt.ts` de la generación; `OPENAI_MODEL_CONSULTA`; sin objetivo declarado no llama al
  LLM y es `mantencion`). Solo "definicion" puede no ser factible: si ni 1 mes de pérdida (2 kg) deja al
  paciente con IMC ≥ 20 y %GC sobre el mínimo por sexo (H 10 %, M 20 %), `feasible = false` con el mensaje
  para el paciente. Reglas en `domain/services/projection/projection.service.ts`
  ([doc/nutrition-plan/proyeccion.md](./doc/nutrition-plan/proyeccion.md)).

**`POST /consultations`** (`CreateConsultationUseCase`): crea la consulta y su orden **antes** del pago.

- **Request** (`CompleteConsultationDtoImpl`): `personalInfo`, `anamnesis`, `measurements` (por ahora
  solo `weight`/`height`/`somatotype`). `personalInfo` sigue siendo obligatorio en el contrato pero ya
  no se lee: los datos personales salen del `User` del token.
- **Response**: `{ orderId: string }`.
- 400 si el perfil no está completo, o si el objetivo no es factible (re-ejecuta CU-CON-03 como
  respaldo del chequeo del frontend; el 400 lleva el mismo mensaje). Resuelve (find-or-create) el `ClinicalRecord` del paciente y el
  `Product` activo `GENERATED`, crea la `Order` con `CreateOrderUseCase` (billing:
  `paymentStatus='PENDING'`, `generationStatus='NOT_STARTED'`, sin archivos) y persiste el árbol
  `NutritionalConsultation` (con `orderId` y `consultationNumber` correlativo) + `Anamnesis`/`Measurements`
  y sus hijas en una escritura anidada. Orden y consulta hoy se escriben en dos operaciones separadas
  (pendiente, ver CU-BIL-01 en use-cases.md). Mapeo completo: `consultation.mapper.ts` y
  [doc/orders-postgres-migration.md](./doc/orders-postgres-migration.md).

### plans: `/plans/standard` y `/me/plans`

Catálogo de planes estándar (`Product` `PREDEFINED`, identificados por `code` con formato
`<plan>-<pesoMin>-<pesoMax>-<sexo>-<edad>`, ver `domain/services/utils/predefined-plan-code.ts`) y planes
del usuario. Flujo completo: [../doc/flows/purchase-flow-predefined-plan.md](../doc/flows/purchase-flow-predefined-plan.md).

- **`GET /plans/standard/previews`** (público): una ficha por familia de plan para el carrusel del home,
  `{ code, name, description, thumbnailUrl }[]`.
- **`GET /plans/standard/:code`** (público): `{ code, name, description, price, currency, thumbnailUrl }`.
  404 si el código tiene formato inválido o la versión no existe / está inactiva. Nunca expone
  `pdfKey`/`thumbnailKey`, solo URLs firmadas (10 min).
- **`POST /plans/standard/:code/purchase`** (sesión, sin body): crea la orden del plan con
  `CreateOrderUseCase` (`amount = product.price`). No exige perfil completo ni crea ficha clínica. 404
  con el mismo criterio que la ficha, o si la versión todavía no tiene PDF. La orden nace **sin**
  `pdfKey`/`thumbnailKey`: se copian del producto recién al confirmarse el pago, para que una orden
  impaga nunca exponga el PDF. Responde `{ orderId }`.
- **`GET /me/plans`** (sesión, `ListMyPlansUseCase`, CU-PLN-04): órdenes del usuario con plan listo y PDF
  (`generationStatus='COMPLETED'` y `pdfKey` no nulo), más nuevas primero, como `MyPlanSummaryDto[]`:
  `{ orderId, type: 'GENERATED'|'PREDEFINED', name, purchasedAt, pdfUrl, thumbnailUrl, summary }`.
  `name` y `summary` (`goal`, `dietRegimen`, `*Intake`) salen del `NutritionalPlan` principal en los
  personalizados y de `product` en los estándar (hoy `product` no tiene esos campos cargados → `summary: null`).
  `purchasedAt` = `paymentDate` (o `creationDate`). `pdfUrl` se firma como descarga (`Content-Disposition:
  attachment`, `plan-nutricional-<YYYY-MM-DD>.pdf`); `thumbnailUrl` es la miniatura WebP o `null`.
- **`GET /me/plans/:orderId`** (sesión, `GetMyPlanUseCase`, CU-PLN-05): detalle de solo lectura. Busca la orden
  por (`id`, `userId` del token) y lista (`COMPLETED` + `pdfKey`) en una sola consulta
  (`OrderRepository.getReadyOrderWithPlanDetailByIdAndUserId`); si no, **404** (R2); id no UUID v4 → 400.
  Devuelve `MyPlanDetailDto` (`modules/plans/dto/my-plan.dto.ts`): lo mismo que la lista más `generated`
  (personalizado: `NutritionalPlan` principal con requerimientos, ingesta, tiempos de comida con porciones y
  notas, suplementos con efectos/consideraciones y recomendaciones deportivas) o `predefined` (`description`
  + resumen del producto). Los planes generados antes de poblarse las tablas hijas caen a `order.planJson`,
  pasado por el mismo `mapPlanToNutritionalPlanDto` de la generación (`my-plan.mapper.ts`).
- **`GET /me/plans/latest/projection`** (sesión, `GetMyLatestPlanProjectionUseCase`, CU-PLN-07): período del
  último `NutritionalPlan` principal del usuario con `end_date` (el de `start_date` más reciente,
  `NutritionalPlanRepository.getLatestDatedMainPlanWithProjectionByUserId`) y la última `projection` de su
  `plan`. Devuelve `MyLatestPlanProjectionDto`: `{ orderId, planName, startDate, endDate, projection: {
  projectedStartDate, projectedEndDate, weight, bmi, bfKg, bfPercentage, mmKg, mmPercentage } | null }`
  (fechas `YYYY-MM-DD`). Sin plan con período → **404**. Alimenta el gráfico de evolución del front.

### billing: `/orders`, `/webhooks/payments` y `/dev/orders`

- **`GET /orders/:id/status`** (sesión, `id` UUID v4): endpoint de polling de la página de la orden.
  Valida que la orden sea del usuario del token; si no existe o es de otro usuario responde 404 en
  ambos casos (anti-BOLA). Responde
  `{ paymentStatus, generationStatus, planJson, pdfUrl, thumbnailUrl }`, con las URLs firmadas igual que
  `GET /me/plans` (`order-files.ts`).
- **`POST /webhooks/payments`** (body `{ orderId }`, provisorio hasta integrar Transbank) y
  **`POST /dev/orders/:id/simulate-payment`** ejecutan el mismo `ConfirmPaymentUseCase`. El webhook
  valida antes la firma (`verifyWebhookSignature()`, **hoy siempre `true`**: es el punto de extensión de
  la pasarela real). El simulador no tiene firma y solo responde con `ENABLE_PAYMENT_SIMULATION=true`
  (`PaymentSimulationEnabledGuard`, 404 si no).
- Lógica de `ConfirmPaymentUseCase`:
  1. Carga la orden con su producto (404 si no existe).
  2. `OrderRepository.markOrderAsPaidWithPayment` ejecuta **en una transacción**:
     `paymentStatus: PENDING → PAID` (solo si estaba `PENDING`) + fila `payment` `AUTHORIZED`
     (`provider = 'SIMULATED'` y detalle placeholder mientras el pago sea simulado). Para un producto
     `PREDEFINED` copia además `pdfKey`/`thumbnailKey` del producto y deja la orden `COMPLETED`.
  3. Si esta llamada marcó el pago emite `order.paid { orderId, productType }` y responde
     `{ status: 'processed' }`; si ya estaba pagada responde `{ status: 'already_processed' }` sin crear
     otro `payment` ni emitir el evento (idempotente). No espera a que termine la generación.

### Generación del plan (background)

No es un endpoint HTTP: `OrderPaidListener` (`modules/plans/listeners/`) escucha `order.paid` y, solo
para productos `GENERATED`, ejecuta `GeneratePersonalizedPlanUseCase` sin esperarlo (fire-and-forget,
con un `catch` de red de seguridad). Ver el detalle paso a paso en
[flow-happy-path.md § Generación del plan](./doc/flow-happy-path.md#7-generación-del-plan-proceso-en-segundo-plano-sin-request-http-del-frontend).

Resumen:

1. Guard de estado (`OrderLifecycleService.tryStartGeneration`: solo entra si estaba `NOT_STARTED` o
   `ERROR`), para no generar el plan dos veces ante disparos concurrentes.
2. Reconstruye la consulta por `nutritional_consultation.order_id` y el usuario desde la orden.
3. Le pide al LLM (`EXTRACT_INFO_SYSTEM_PROMPT`) que clasifique el nivel de actividad física y el
   objetivo (`definicion` | `mantencion` | `volumen`).
4. Calcula edad, requerimientos (ver [fórmulas](#fórmulas-de-requerimientos-energéticos)) y suplementos
   **sin IA**, y le pide al LLM (`NUTRITIONIST_SYSTEM_PROMPT`, `generation/plan-generation.prompts.ts`) que
   genere el plan usando **exactamente** esos valores y expresando cada tiempo de comida en
   **porciones por grupo de intercambio** (ver [Porciones de alimentos](#porciones-de-alimentos)). La
   respuesta se valida en código contra las porciones calculadas.
5. Reintenta hasta 4 veces con backoff exponencial. Si tiene éxito: renderiza el PDF una sola vez
   (`PlanDocumentRenderer.renderPdf`), lo sube a `productos-personalizados/<orderId>.pdf`
   (`FileStorage.uploadPdf`), genera y sube la miniatura WebP (`renderThumbnail`, **best-effort**: si
   falla queda `thumbnailKey = null` sin consumir un reintento), guarda `plan` + `nutritional_plan`
   principal (`PlanRepository.upsertPlanWithMainNutritionalPlanByOrderId`), marca la orden `COMPLETED`
   con `planJson`/`pdfKey`/`thumbnailKey` (`OrderLifecycleService.completeGeneration`) y envía el correo
   con el mismo buffer (`EmailSender.sendPlanByEmail`). Si agota los reintentos, la orden queda `ERROR`
   (`recordFailedAttempt`) y se registra el evento.


## Capa de dominio

### Fórmulas de requerimientos energéticos

`src/domain/services/formulas/requirements/requirements.service.ts`:

- **`tasaMetabolicaBasal` (TMB)**: Harris-Benedict (1919) para mayores de 18 años; FAO/OMS/UNU (1985) para
  menores (con corte adicional en 10 años), separado por sexo.
- **`gastoEnergeticoTotal` (GET)**: `TMB * (1 + (nivel_actividad_fisica - 1) + (CONSTANTE_TERMOGENESIS - 1))`,
  con `CONSTANTE_TERMOGENESIS = 1.1`.
- **`calculoRequerimientos`**: a partir del GET y el `objetivo`:
  - `energia`: GET − 500 (definición), GET + 200 (volumen), o GET (mantención).
  - `proteina`: `peso * 1.5` g.
  - `carbohidrato`: 50% de la energía (definición) o 55% (volumen/mantención), convertido a gramos (÷4).
  - `lipido`: el resto de la energía tras descontar proteína y carbohidrato, convertido a gramos (÷9).

`src/domain/services/formulas/requirements/supplements.service.ts` calcula `calculoSuplementos(peso)`, una
prescripción de suplementos (ej. creatina, proteína) en función del peso del paciente, usada como
input fijo del prompt de generación del plan (igual que los requerimientos: la IA no la recalcula).

### Resultados de una medición

`src/domain/services/measurements/measurement-results.calculator.ts` → `calculateMeasurementResults`
arma la fila de `measurement_results` al crear o editar una medición (CU-CON-02, CU-CLI-05, CU-CLI-06):
IMC y su clasificación (`formulas/indexes/bmi.service.ts`) con peso y talla y, en una bioimpedancia, kg y
% de grasa corporal, masa muscular, grasa visceral y masa ósea (`formulas/body-composition/mass-conversion.service.ts`).

Otros servicios de fórmulas presentes en `domain/services/formulas/` (suma de pliegues, masa
muscular, % grasa corporal por pliegues, phantom, IMM, perímetros corregidos, somatocarta, sesión
deportiva) implementan cálculos de evaluación antropométrica y deportiva clásicos en nutrición
deportiva, pero **aún no están conectados** al flujo de generación del plan (los `mediciones` que llegan hoy solo
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

Los casos de uso hablan con el modelo a través del puerto `LlmProvider` (`domain/ports`), implementado
por `OpenaiLlmProvider` (`src/infrastructure/llm/openai/openai-llm.provider.ts`): un wrapper delgado
sobre el SDK de `openai` que expone `chatJson<T>(systemPrompt, messages, model?, temperature?)`, llama a
`chat.completions.create` con `response_format: { type: 'json_object' }`, hace `JSON.parse` del contenido
y lanza `InternalServerErrorException` si la respuesta viene vacía. Es el único punto de acceso a
OpenAI del backend; lo usan `ChatAnamnesisUseCase` (chat de anamnesis) y
`GeneratePersonalizedPlanUseCase` (clasificación de actividad/objetivo y generación del plan), cada uno
con sus propios prompts (`modules/consultation/prompts/` y `modules/plans/generation/`).


## PDF y almacenamiento en S3

- **`PlanDocumentRendererModule` (`infrastructure/pdf/`)**: `ReactPdfPlanDocumentRenderer.renderPdf(plan)` (puerto `PlanDocumentRenderer`) renderiza
  `NutritionPlanDocument` (definido con primitivas de `@react-pdf/renderer`) a un `Buffer` PDF. El
  mismo componente de documento se reutiliza en el frontend para la descarga client-side del plan
  (pantalla `/ordenes/[id]`), sin duplicar el layout.
- **`FileStorageModule` (`infrastructure/storage/s3/`)**: `S3FileStorage` (puerto `FileStorage`) envuelve `@aws-sdk/client-s3` +
  `@aws-sdk/s3-request-presigner` y expone estos métodos:
  - `uploadPdf(buffer, key)`: sube el PDF al bucket privado `nutricionista-virtual-planes-pdfs`.
  - `uploadImage(buffer, key, contentType = 'image/webp')`: sube la miniatura del plan.
  - `getSignedDownloadUrl(key, ttlSeconds = 600, { downloadFilename }?)`: como el bucket no tiene acceso
    público, esta URL firmada es la única forma de leer el objeto; expira en `ttlSeconds` y nunca se
    persiste, se genera on-demand en cada request. Con `downloadFilename` firma además
    `Content-Disposition: attachment` (fuerza la descarga con ese nombre); sin él, el objeto se sirve
    inline.
  El bucket tiene dos carpetas: `productos-personalizados/` (planes generados por consulta, en uso —
  key `<orderId>.pdf` vía el helper `buildPersonalizedPlanKey` (`domain/services/utils/storage-keys.ts`), y sus miniaturas en
  `miniaturas/<orderId>.webp` vía `buildPlanThumbnailKey`) y `productos-estandarizados/` (planes
  predefinidos, subidos a mano: PDF en `<code>.pdf` vía `buildPredefinedPlanKey` y miniatura en
  `miniaturas/<code>.webp` vía `buildPredefinedPlanThumbnailKey`; el catálogo se carga con
  `npm run seed:predefined`, ver [doc/flows/purchase-flow-predefined-plan.md](../doc/flows/purchase-flow-predefined-plan.md)). Lee
  `AWS_REGION`/`AWS_S3_BUCKET_NAME`/`AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY` de `ConfigService`
  (`.env.template`).
  `GeneratePersonalizedPlanUseCase` genera el PDF **una sola vez** por generación exitosa
  (`PlanDocumentRenderer.renderPdf`), lo sube a S3 y persiste su key en `Order.pdfKey`; el mismo buffer se
  reutiliza para el adjunto del correo, sin regenerarlo (ver
  [Generación del plan](#generación-del-plan-background)).
- **Miniatura (`ThumbnailService`, detrás de `PlanDocumentRenderer.renderThumbnail`)**: `generateFirstPage(pdfBuffer)` rasteriza la
  página 1 del PDF a WebP (800 px de ancho, calidad 80, ~30 KB) con `pdfjs-dist` (build `legacy`,
  cargado con `import()` dinámico porque es ESM puro y el build de Nest es CJS) sobre
  `@napi-rs/canvas` (binarios precompilados; no requiere instalar nada en el sistema). Puntos a
  tener en cuenta:
  - pdfjs necesita las fuentes estándar (`node_modules/pdfjs-dist/standard_fonts/`) para dibujar el
    texto Helvetica del PDF; se le pasan como **ruta del sistema de archivos con `/` final** (también en
    Windows), no como URL `file://`. Sin ellas el texto sale con una fuente sustituta deformada.
  - Como Jest corre en CJS, `import()` de un ESM falla sin `--experimental-vm-modules`, por lo que este
    servicio **no tiene spec unitario**: los specs que lo consumen lo mockean, y su funcionamiento real
    se verifica con el build compilado (`nest build`).
  - En Linux, `@napi-rs/canvas` usa el binario `linux-x64-gnu` (o `musl` en Alpine), que `npm ci` resuelve.
- **`EmailModule` (`infrastructure/email/`)**: `LogEmailSender.sendPlanByEmail(email,
  plan, attachment)` recibe el PDF ya generado como `Buffer` — **ya no depende de `PlanDocumentRenderer`** —
  arma el asunto/cuerpo del correo y llama a `sendRealEmail` — **hoy un stub** que solo deja un log
  estructurado; no hay proveedor de correo (SendGrid/SES/Resend/etc.) conectado todavía.

## Manejo de errores

`HttpExceptionFilter` (`src/common/filters/http-exception.filter.ts`) es un `ExceptionFilter` global
(registrado en `main.ts`) que captura toda `HttpException`, normaliza el `message` (venga como string,
array o `{ message | error }`), lo loguea con `Logger`, y responde `{ statusCode, message, timestamp,
path }`. Fuera de `NODE_ENV=production`, además incluye `exception: { name, response }` para depuración.

## Base de datos (Prisma)

`prisma/schema.prisma` corre sobre **PostgreSQL** y modela el dominio completo del producto
(identidad/auth, historial clínico, comercial) — 35 modelos en total, organizados en tres secciones
del schema: `IDENTITY & AUTH`, `CLINICAL DOMAIN`, `COMMERCIAL DOMAIN`. El flujo comercial descrito en
este README (`POST /consultations` → pago → generación del plan) persiste sobre este dominio real, no
sobre una tabla plana con un payload JSON crudo. Ver el detalle completo de la arquitectura de esta
capa (entidades, DTOs, datasources, repositories) en
**[doc/postgres-domain-groundwork.md](./doc/postgres-domain-groundwork.md)**, y el detalle de cómo se
conectó al flujo comercial en
**[doc/orders-postgres-migration.md](./doc/orders-postgres-migration.md)**.

Modelos que participan directamente en el flujo comercial hoy:

| Modelo | Rol |
|---|---|
| `User` (`identity-auth`) | Resuelto por el `sub` del Access Token de Cognito vía `CurrentUserResolver.resolve` (ver [doc/auth.md](./doc/auth.md)); `GET`/`PATCH /me` leen/actualizan sus campos de perfil |
| `ClinicalRecord` (`clinical-domain`) | Uno por paciente (`patientId` `@unique`), find-or-create |
| `NutritionalConsultation` (`clinical-domain`) | Una por cada `POST /consultations`; vinculada 1:1 a la `Order` vía `orderId`; contiene el árbol `Anamnesis`+hijas y `Measurements`+hija que antes viajaba como `payload_json`. `NutritionalConsultationRepository` expone dos formas de traerla con detalle: `getNutritionalConsultationWithDetailsByOrderId` (`FULL_DETAILS_INCLUDE`, usado por la generación del plan) y la nueva `getLatestNutritionalConsultationWithDetailsByPatientId` (`PANEL_DETAILS_INCLUDE`: `patient`, `anamneses.goals`, `nutritionalPlans` — `findFirst` ordenado por `consultationNumber: 'desc'`, usada por `GET /me/summary`); son includes deliberadamente distintos para no alterar el comportamiento del lookup existente por orden |
| `Product` (`commercial-domain`) | Dos usos: el producto `type='GENERATED' active=true` (uno solo, find-or-create con valores placeholder, ver deuda técnica) y las 112 versiones de plan `type='PREDEFINED'` (`code` único, `pdfKey`/`thumbnailKey` en `productos-estandarizados/`, cargadas con `npm run seed:predefined`) |
| `Order` (`commercial-domain`) | Reemplaza al modelo `Order` legacy de SQLite (ya no existe en el schema); ver campos abajo |

Campos relevantes de `Order` (tabla `order`):

| Campo | Uso |
|---|---|
| `id` | UUID, generado en `CreateConsultationUseCase` |
| `userId` / `productId` | FKs a `User` y `Product` |
| `amount` / `currency` | Copiados de `Product` al crear la orden |
| `paymentStatus` | `'PENDING'` \| `'PAID'` |
| `generationStatus` | `'NOT_STARTED'` \| `'GENERATING'` \| `'COMPLETED'` \| `'ERROR'` |
| `planJson` | `NutritionPlanDto` resultante serializado, `null` hasta que se genera |
| `pdfKey` | Key del PDF del plan en el bucket S3. `GENERATED`: `productos-personalizados/<orderId>.pdf`, `null` hasta que se genera. `PREDEFINED`: copia de `Product.pdfKey`, solo desde que se confirma el pago — ver [PDF y almacenamiento en S3](#pdf-y-almacenamiento-en-s3) |
| `thumbnailKey` | Key de la miniatura WebP de la página 1 del PDF (`productos-personalizados/miniaturas/<orderId>.webp`); `null` si aún no se genera, si falló (es best-effort) o si el plan es anterior a esta función (sin backfill) |
| `attempts` | Contador de intentos fallidos de generación |
| `nutritionalConsultation` | Relación inversa 1:1 hacia la `NutritionalConsultation` con los datos de la anamnesis/mediciones de esta orden |

La autenticación es real vía Amazon Cognito (`AuthIdentity` + `User`, ver
[doc/auth.md](./doc/auth.md)) — ver `doc/orders-postgres-migration.md` y `doc/technical-debt.md` para
el detalle de esa migración y su deuda pendiente. `Payment` sí está conectado: el webhook de pago crea su fila (`AUTHORIZED`, hoy con datos simulados) en la misma transacción que marca la orden pagada. Buena parte del resto del dominio (la
mayoría de `clinical-domain` fuera de lo que usa la consulta nutricional básica) sigue sin ningún
consumidor real — no asumir que "todo" el dominio Postgres está conectado. `NutritionalPlan` (solo
la fila principal y sus tablas hijas) está conectado: `GeneratePersonalizedPlanUseCase` lo **escribe**
(`PlanRepository.upsertPlanWithMainNutritionalPlanByOrderId`, idempotente por `orderId`: crea el `Plan` de la orden con su `NutritionalPlan` principal y sus hijas `PlanMealTime` + notas, `PlanSupplement` + notas y `PlanSportsRecommendation`, o reemplaza ese árbol; las hijas se borran por `ON DELETE CASCADE`) justo antes de
marcar la orden como `COMPLETED`, y `GET /me/summary` la **lee** (`plans` → `nutritionalPlans` incluido en
`getLatestNutritionalConsultationWithDetailsByPatientId`, que solo considera consultas que ya tienen
plan). Las órdenes completadas antes de este cambio no tienen fila `NutritionalPlan` (sin backfill).
Desde la migración `20260925120000_plan_entity`, `NutritionalPlan` ya no cuelga directamente de la
consulta ni de la orden: cuelga de `Plan` (`consultationId`, `orderId @unique`, `active`), que puede
agrupar varios `NutritionalPlan` (hoy uno solo, `mainPlan = true`, con `planName` = nombre del
producto y `startDate` = fecha de generación; `period` queda en null). `endDate` y la `Projection` del
`Plan` los fija la generación según el objetivo clasificado (`calculateProjection`,
`domain/services/projection/projection.service.ts`, reglas en
[doc/nutrition-plan/proyeccion.md](./doc/nutrition-plan/proyeccion.md)): "definicion" proyecta −2 kg/mes de
grasa por 3 meses, acortando a 2 o 1 mes si el resultado baja de IMC 20 o del %GC mínimo por sexo;
"volumen" proyecta +1 % del peso inicial/mes de músculo por 3 meses; "mantencion" no crea `Projection`.
`endDate` = inicio + meses proyectados (3 si no hay proyección). La `Projection` se crea en el mismo upsert
(en un reintento se reemplaza). %GC/masa muscular de base salen de la medición más reciente del historial
que los tenga; sin ella, la proyección lleva solo peso e IMC.

No hay job de retención: `Order.planJson` (y el resto de la orden) se conserva sin límite de tiempo.

## Testing

Cada controller, caso de uso, adaptador y servicio de `domain/services` trae su(s) `.spec.ts`
co-localizado(s) junto al archivo que testea. Comandos: `npm run test` (unitarios), `npm run test:e2e`, `npm run
test:cov`. Ver **[doc/testing.md](./doc/testing.md)** para el detalle de qué cubre cada test, las
decisiones de infraestructura (stub de `@react-pdf/renderer`), y la deuda pendiente
(fórmulas sin consumidor sin testear, e2e sin verificar en CI).

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
- No hay pasarela de pago real integrada (`ConfirmPaymentUseCase.verifyWebhookSignature` siempre devuelve
  `true`) ni proveedor de correo real conectado (`LogEmailSender.sendRealEmail` es un stub que solo
  logea).
- `GeneratePersonalizedPlanUseCase` persiste `NutritionalPlan` y sus hijas desde la migración
  `20260927120000_nutritional_plan_children`, pero no se hizo backfill: las órdenes completadas antes
  solo tienen el detalle en `Order.planJson` (y las anteriores a la escritura de `NutritionalPlan`, ni
  siquiera esa fila). `Projection` y `NutritionalPlan.endDate` se pueblan desde la generación solo para
  los planes nuevos (sin backfill de los anteriores).
- El bucket S3 para los PDFs de planes ya existe y está en uso (`productos-personalizados/` y
  `productos-estandarizados/`, ver [PDF y almacenamiento en S3](#pdf-y-almacenamiento-en-s3)). Los
  archivos predefinidos se suben **a mano** (no hay un flujo de subida automatizado): tras subirlos hay
  que correr `npm run seed:predefined`, que activa las versiones cuyo PDF existe. Los precios de las
  112 versiones son placeholders (`predefined-products.seed-data.ts`).
- El pago sigue siendo simulado: la fila `payment` del webhook usa `provider = 'SIMULATED'` con campos de
  detalle placeholder hasta integrar una pasarela real.
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
- Los datos de salud (`Order.planJson`, `NutritionalConsultation` y `NutritionalPlan`) se conservan
  sin límite de tiempo: se eliminó el job de retención de 45 días. Si más adelante se necesita una
  política de retención/anonimización, hay que definirla también para `NutritionalPlan`.
