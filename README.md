# NutriApp Back

Backend en [NestJS](https://nestjs.com/) para NutriApp: un agente conversacional que, apoyado en OpenAI,
recopila la anamnesis de un paciente por chat, procesa el pago de la consulta y genera de forma
asíncrona un plan nutricional personalizado (enviado por correo en PDF y descargable desde el frontend).

> Para el recorrido end-to-end de una consulta exitosa, con el orden exacto en que se usan los
> endpoints, ver **[flow-happy-path.md](./doc/flow-happy-path.md)**.

> Estado actual: el proyecto cubre el flujo completo **anamnesis (chat) → creación de orden → pago
> (simulado) → generación del plan con IA en background → consulta de estado/plan → envío por
> correo (stub)**, más un endpoint dedicado de perfil (`GET`/`PATCH /user/me`) y uno de resumen para
> un panel del usuario (`GET /panel/resumen`). La persistencia (Prisma + **Postgres**) está conectada
> para el dominio comercial completo (`User`, `ClinicalRecord`,
> `NutritionalConsultation`/`Anamnesis`/`Measurements`, `Order`, `Product`) — ver
> [Base de datos](#base-de-datos-prisma) y
> [doc/orders-postgres-migration.md](./doc/orders-postgres-migration.md). La autenticación es real,
> vía Amazon Cognito (`presentation/auth/`, `CognitoAuthGuard`) — ver **[doc/auth.md](./doc/auth.md)**
> — el `User` se resuelve por el `sub` del token validado, no por email suelto.

## Índice

- [Stack](#stack)
- [Arquitectura](#arquitectura)
- [Puesta en marcha](#puesta-en-marcha)
- [Variables de entorno](#variables-de-entorno)
- [Módulos y endpoints](#módulos-y-endpoints)
  - [`POST /consulta/chat`](#post-consultachat)
  - [`POST /ordenes/crear`](#post-ordenescrear)
  - [`GET /ordenes/obtener-estado/:id`](#get-ordenesobtener-estadoid)
  - [`GET /ordenes`](#get-ordenes)
  - [`POST /webhooks/pago` y `POST /webhooks/ordenes/:id/simular-pago`](#post-webhookspago-y-post-webhooksordenesidsimular-pago)
  - [Generación del plan (background)](#generación-del-plan-background)
  - [`GET /user/me` y `PATCH /user/me`](#get-userme-y-patch-userme)
  - [`GET /panel/resumen`](#get-panelresumen)
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
│   ├── auth/               # Guard JWT de Cognito + endpoints de identidad/perfil (ver doc/auth.md)
│   ├── user/               # Endpoint dedicado de perfil para la pantalla /perfil del frontend
│   ├── panel/              # Resumen de usuario/objetivo/plan para la pantalla /panel del frontend
│   ├── consultation/       # Chat conversacional de recopilación de la anamnesis
│   ├── orders/             # Creación/consulta de la orden de cobro
│   ├── webhooks/           # Webhook de pago (real y simulado) → dispara la generación del plan
│   ├── plan-generation/    # Worker que genera el plan con IA (disparado por el webhook de pago)
│   ├── pdf/                # Generación del PDF del plan (@react-pdf/renderer)
│   ├── storage/            # Persistencia del PDF del plan en S3 (subida + URL de descarga firmada)
│   ├── notifications/      # Envío del plan por correo (stub, con el PDF ya generado como adjunto)
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
[Base de datos](#base-de-datos-prisma)), `OrdersModule`, `WebhooksModule` (este último importa
`PlanGenerationModule`, que a su vez importa `OrdersModule`, `OpenaiModule`, `NotificationsModule`,
`PdfModule` y `StorageModule` directamente), `UserModule` y `PanelModule`. En conjunto,
`OrdersModule`/`WebhooksModule`/`PlanGenerationModule` forman la cadena: pago confirmado →
generación del plan → PDF → subida a S3 → correo (con el mismo PDF ya generado como adjunto).
`OrdersModule` importa los tres `*RepositoriesModule` (para los repositories que usa
`OrdersService`) y también `StorageModule`, para firmar la URL de descarga del PDF que devuelven
`GET /ordenes/obtener-estado/:id` y `GET /ordenes`. `NotificationsModule` ya no importa `PdfModule`:
`EmailService` recibe el buffer del PDF ya generado en vez de generarlo internamente.

`AuthModule` (`presentation/auth/`, guard `CognitoAuthGuard` + `AuthIdentityService` — ver
[doc/auth.md](./doc/auth.md)) no está en la lista de arriba porque no se importa directo en
`AppModule`: lo importan `ConsultationModule`, `OrdersModule`, `UserModule` y `PanelModule`, cada uno
para las rutas propias que exigen sesión de Cognito. `UserModule` importa además
`IdentityAuthRepositoriesModule` (para `UserRepository`) y `PanelModule`
`ClinicalDomainRepositoriesModule` (para `NutritionalConsultationRepository`).

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
`presentation/**/dto` — no hace falta (ni se usa en este proyecto) anotarlas manualmente con
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
    pdfUrl: string | null, // URL firmada de S3 (10 min) para DESCARGAR el PDF (attachment), null hasta que el plan termine de generarse
    thumbnailUrl: string | null, // URL firmada de S3 (10 min) de la miniatura WebP de la página 1; null si aún no hay plan o si no tiene miniatura
  }
  ```
  El `pdfUrl` se firma igual que en `GET /ordenes` (`Content-Disposition: attachment` con nombre
  `plan-nutricional-<YYYY-MM-DD>.pdf`), porque el frontend ya no incrusta el PDF en un `<iframe>`: muestra la
  miniatura y un botón "Descargar". La miniatura ya está disponible cuando `generationStatus` pasa a
  `completado` (`thumbnailKey` se persiste en la misma escritura que el estado).
- Valida que la orden pertenezca al usuario del token (`order.userId` contra el `User` resuelto vía
  `AuthIdentityService.getUserBySub`); si no coincide, responde `404` igual que si la orden no
  existiera, para no filtrar cuál de los dos casos ocurrió. Esto corrige un gap de BOLA (Broken
  Object Level Authorization) documentado anteriormente en `doc/auth.md`/`doc/technical-debt.md`.
- 404 (`NotFoundException`) si el `id` no corresponde a ninguna orden, o si corresponde a una orden
  de otro usuario.

### `GET /ordenes`

Lista las órdenes con plan generado y PDF disponible del usuario autenticado, usada por un panel del
frontend para mostrar el historial de planes descargables.

- **Controller**: `OrdersController.list` → `OrdersService.getOrdersForUser`
- **Response** (`OrderSummaryDto[]`), ordenado por `creationDate` descendente:
  ```ts
  { orderId: string, creationDate: Date, pdfUrl: string, thumbnailUrl: string | null }[]
  ```
  - `pdfUrl`: URL firmada (600 s) para **descargar** el PDF. Se firma con
    `ResponseContentDisposition: attachment; filename="plan-nutricional-<YYYY-MM-DD>.pdf"`, así que el
    navegador lo descarga en vez de abrirlo (el atributo `download` de un `<a>` se ignora en
    cross-origin). Por eso **no sirve para un `<iframe>`** (ningún endpoint sirve ya el PDF inline).
  - `thumbnailUrl`: URL firmada de la miniatura WebP de la página 1 del plan, o `null` si la orden no
    tiene miniatura (plan generado antes de esta función, o falló su rasterización). El frontend
    muestra un placeholder en ese caso.
- Solo incluye órdenes con `generationStatus='completado'` y `pdfKey` no nulo
  (`OrderRepository.getPaidOrdersWithPdfByUserId`, `Prisma.findMany`). Filtra siempre por el usuario
  del token y nunca recibe un id externo, por lo que no hay BOLA posible acá (a diferencia de
  `GET /ordenes/obtener-estado/:id`).

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
6. Reintenta hasta 4 veces con backoff exponencial ante cualquier error, incluyendo fallos al generar
   el PDF o al subirlo a S3 (caen en el mismo loop de reintentos). Si tiene éxito: genera el PDF una
   sola vez (`PdfService.generateBuffer`), lo sube a S3 (`StorageService.uploadPdf`, key
   `productos-personalizados/<orderId>.pdf`), rasteriza su página 1 a una miniatura WebP
   (`ThumbnailService.generateFirstPage`) y la sube a
   `productos-personalizados/miniaturas/<orderId>.webp` (**best-effort**: si falla, se registra un
   warning, `thumbnailKey` queda `null` y **no** consume un reintento ni falla el plan), y persiste el
   plan junto al `pdfKey`/`thumbnailKey` en la orden en la misma llamada
   (`generationStatus='completado'`) — luego llama a `EmailService.sendPlanByEmail`
   reutilizando el mismo buffer del PDF para el adjunto, sin regenerarlo. Si agota los reintentos,
   marca `generationStatus='error'` y registra el evento.

### `GET /user/me` y `PATCH /user/me`

Endpoint dedicado de perfil para la pantalla `/perfil` del frontend (edición del perfil ya
existente, fuera del wizard de onboarding). Ambas rutas están en `presentation/user/`
(`UserController` → `UserService`), protegidas por `CognitoAuthGuard`, y resuelven el `User` vía
`@CognitoUser()` + `AuthIdentityService.getUserBySub` (igual patrón que `PATCH /auth/perfil`, ver
[doc/auth.md](./doc/auth.md)).

- **`GET /user/me`** (`UserService.getProfile`)
  - **Response** (`UserProfileResponseDto`, todos los campos nullable):
    ```ts
    { firstName: string | null, paternalLastName: string | null, dateOfBirth: Date | null, email: string | null }
    ```
- **`PATCH /user/me`** (`UserService.updateProfile`)
  - **Request** (`UpdateUserProfileDtoImpl`): `{ firstName, paternalLastName, dateOfBirth }`, los
    tres obligatorios (`class-validator`: `@IsString`/`@IsNotEmpty`, `dateOfBirth` con
    `@IsDateString`).
  - Actualiza solo esos tres campos vía `UserRepository.updateUserById`. **`email` es de solo
    lectura y no se acepta en el body** — misma razón que en `PATCH /auth/perfil`: siempre viene de
    la sesión de Cognito (`syncUser`), nunca de un formulario.
  - **Response**: el mismo `UserProfileResponseDto` actualizado.

Distinto de `PATCH /auth/perfil` (que completa el perfil durante el onboarding y además exige
`gender`): este endpoint es la edición posterior desde `/perfil` y no toca `gender`.

### `GET /panel/resumen`

Endpoint de resumen para la pantalla `/panel` del frontend (dashboard con datos básicos del usuario
+ objetivo y macros de su último plan). `presentation/panel/` (`PanelController` → `PanelService`),
protegido por `CognitoAuthGuard`.

- **Response** (`PanelSummaryDto`):
  ```ts
  {
    firstName: string | null,
    paternalLastName: string | null,
    age: number | null,
    goal: string | null,
    nutritionalPlan: { calorieIntake, proteinIntake, carbohydrateIntake, lipidIntake } | null,
  }
  ```
- Lógica de `PanelService.getSummary`:
  1. Resuelve el `User` vía `AuthIdentityService.getUserBySub`.
  2. Llama a
     `NutritionalConsultationRepository.getLatestNutritionalConsultationWithDetailsByPatientId(user.id)`
     (nuevo método, ver [Base de datos](#base-de-datos-prisma)) para traer la
     `NutritionalConsultation` más reciente del paciente, con `patient`, `anamneses.goals` y
     `nutritionalPlans` incluidos en una sola consulta.
  3. `goal` sale de `consultation.anamneses[0]?.goals[0]?.mainGoal`; `nutritionalPlan` sale de
     `consultation.nutritionalPlans[0]`, tomando **solo los campos `*Intake`** (`calorieIntake`,
     `proteinIntake`, `carbohydrateIntake`, `lipidIntake`), nunca los `*Requirement`. `age` se
     calcula con `calculateAge()` (`domain/services/utils/age.service.ts`) a partir de
     `user.dateOfBirth`.
  4. Todo es null-safe: si el usuario no tiene ninguna consulta o ningún plan, `goal` y
     `nutritionalPlan` vuelven `null` en vez de fallar.
- El bucket S3 para almacenar los PDFs ya existe y está en uso (ver
  [PDF y almacenamiento en S3](#pdf-y-almacenamiento-en-s3)), pero este endpoint todavía no expone
  `pdfUrl` ni el historial de planes del usuario — eso hoy vive en el endpoint dedicado
  [`GET /ordenes`](#get-ordenes), consumido por una pantalla separada del panel. Fusionarlo en este
  resumen (o no) queda a criterio de una futura pasada de UX.

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

## PDF y almacenamiento en S3

- **`PdfModule` (`presentation/pdf/`)**: `PdfService.generateBuffer(plan)` renderiza
  `NutritionPlanDocument` (definido con primitivas de `@react-pdf/renderer`) a un `Buffer` PDF. El
  mismo componente de documento se reutiliza en el frontend para la descarga client-side del plan
  (pantalla `/ordenes/[id]`), sin duplicar el layout.
- **`StorageModule` (`presentation/storage/`)**: `StorageService` envuelve `@aws-sdk/client-s3` +
  `@aws-sdk/s3-request-presigner` y expone estos métodos:
  - `uploadPdf(buffer, key)`: sube el PDF al bucket privado `nutricionista-virtual-planes-pdfs`.
  - `uploadImage(buffer, key, contentType = 'image/webp')`: sube la miniatura del plan.
  - `getSignedDownloadUrl(key, ttlSeconds = 600, { downloadFilename }?)`: como el bucket no tiene acceso
    público, esta URL firmada es la única forma de leer el objeto; expira en `ttlSeconds` y nunca se
    persiste, se genera on-demand en cada request. Con `downloadFilename` firma además
    `Content-Disposition: attachment` (fuerza la descarga con ese nombre); sin él, el objeto se sirve
    inline.
  El bucket tiene dos carpetas: `productos-personalizados/` (planes generados por consulta, en uso —
  key `<orderId>.pdf` vía el helper `buildPersonalizedPlanKey`, y sus miniaturas en
  `miniaturas/<orderId>.webp` vía `buildPlanThumbnailKey`) y `productos-estandarizados/` (planes
  predefinidos fijos subidos manualmente, pendiente — ver
  [Deuda técnica](#deuda-técnica-y-pendientes)). Lee
  `AWS_REGION`/`AWS_S3_BUCKET_NAME`/`AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY` de `ConfigService`
  (`.env.template`).
  `PlanGenerationService` genera el PDF **una sola vez** por generación exitosa
  (`PdfService.generateBuffer`), lo sube a S3 y persiste su key en `Order.pdfKey`; el mismo buffer se
  reutiliza para el adjunto del correo, sin regenerarlo (ver
  [Generación del plan](#generación-del-plan-background)).
- **Miniatura (`ThumbnailService`, en `PdfModule`)**: `generateFirstPage(pdfBuffer)` rasteriza la
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
- **`NotificationsModule` (`presentation/notifications/`)**: `EmailService.sendPlanByEmail(email,
  plan, attachment)` recibe el PDF ya generado como `Buffer` — **ya no depende de `PdfService`** —
  arma el asunto/cuerpo del correo y llama a `sendRealEmail` — **hoy un stub** que solo deja un log
  estructurado; no hay proveedor de correo (SendGrid/SES/Resend/etc.) conectado todavía.

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
| `User` (`identity-auth`) | Resuelto por el `sub` del Access Token de Cognito vía `AuthIdentityService.getUserBySub` (ver [doc/auth.md](./doc/auth.md)); `GET`/`PATCH /user/me` leen/actualizan sus campos de perfil |
| `ClinicalRecord` (`clinical-domain`) | Uno por paciente (`patientId` `@unique`), find-or-create |
| `NutritionalConsultation` (`clinical-domain`) | Una por cada `POST /ordenes/crear`; vinculada 1:1 a la `Order` vía `orderId`; contiene el árbol `Anamnesis`+hijas y `Measurements`+hija que antes viajaba como `payload_json`. `NutritionalConsultationRepository` expone dos formas de traerla con detalle: `getNutritionalConsultationWithDetailsByOrderId` (`FULL_DETAILS_INCLUDE`, usado por la generación del plan) y la nueva `getLatestNutritionalConsultationWithDetailsByPatientId` (`PANEL_DETAILS_INCLUDE`: `patient`, `anamneses.goals`, `nutritionalPlans` — `findFirst` ordenado por `consultationNumber: 'desc'`, usada por `GET /panel/resumen`); son includes deliberadamente distintos para no alterar el comportamiento del lookup existente por orden |
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
| `pdfKey` | Key del PDF del plan en el bucket S3 (`productos-personalizados/<orderId>.pdf`), `null` hasta que se genera — ver [PDF y almacenamiento en S3](#pdf-y-almacenamiento-en-s3) |
| `thumbnailKey` | Key de la miniatura WebP de la página 1 del PDF (`productos-personalizados/miniaturas/<orderId>.webp`); `null` si aún no se genera, si falló (es best-effort) o si el plan es anterior a esta función (sin backfill) |
| `attempts` | Contador de intentos fallidos de generación |
| `nutritionalConsultation` | Relación inversa 1:1 hacia la `NutritionalConsultation` con los datos de la anamnesis/mediciones de esta orden |

La autenticación es real vía Amazon Cognito (`AuthIdentity` + `User`, ver
[doc/auth.md](./doc/auth.md)) — ver `doc/orders-postgres-migration.md` y `doc/technical-debt.md` para
el detalle de esa migración y su deuda pendiente. Buena parte del resto del dominio (`Payment`, la
mayoría de `clinical-domain` fuera de lo que usa la consulta nutricional básica) sigue sin ningún
consumidor real — no asumir que "todo" el dominio Postgres está conectado. `NutritionalPlan` (solo
la fila principal, no sus tablas hijas) sí está conectado: `PlanGenerationService` la **escribe**
(`NutritionalPlanRepository.upsertNutritionalPlanByOrderId`, idempotente por `orderId`) justo antes de
marcar la orden como `completado`, y `GET /panel/resumen` la **lee** (`nutritionalPlans` incluido en
`getLatestNutritionalConsultationWithDetailsByPatientId`, que solo considera consultas que ya tienen
plan). Las órdenes completadas antes de este cambio no tienen fila `NutritionalPlan` (sin backfill).

No hay job de retención: `Order.planJson` (y el resto de la orden) se conserva sin límite de tiempo.

## Testing

Cada módulo de `presentation` y de `domain/services` trae su(s) `.spec.ts` co-localizado(s) junto
al archivo que testea. Comandos: `npm run test` (unitarios), `npm run test:e2e`, `npm run
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
- No hay pasarela de pago real integrada (`WebhooksService.verifyWebhookSignature` siempre devuelve
  `true`) ni proveedor de correo real conectado (`EmailService.sendRealEmail` es un stub que solo
  logea).
- `PlanGenerationService` persiste la fila `NutritionalPlan` pero no sus hijas (`PlanMealTime`,
  `PlanSupplement`, `PlanSportsRecommendation`): el detalle del plan sigue viviendo solo en
  `Order.planJson`. Tampoco se hizo backfill de las órdenes completadas antes de que existiera la
  escritura de `NutritionalPlan`.
- El bucket S3 para los PDFs de planes ya existe y está en uso
  (`productos-personalizados/`, ver [PDF y almacenamiento en S3](#pdf-y-almacenamiento-en-s3)); la
  carpeta `productos-estandarizados/` (planes predefinidos fijos) sigue sin ningún flujo de subida
  automatizado y el `Product` tipo `PREDEFINIDO` que los usaría no está implementado — fuera de
  alcance de este cambio.
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
