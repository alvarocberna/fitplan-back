# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

NestJS backend for NutriApp: a conversational agent that, backed by OpenAI, collects a patient's
anamnesis via chat, processes payment for the consultation, and asynchronously generates a
personalized nutrition plan (emailed as PDF, also downloadable from the frontend).

The **README.md is the primary source of truth** for this project — it documents every endpoint,
the full plan-generation pipeline, the domain formulas, Prisma schema, and known technical debt in
detail. Read it before making non-trivial changes. `doc/flow-happy-path.md` walks the exact
end-to-end request sequence of a successful consultation; `doc/technical-debt.md` lists known gaps
in more detail than the README's summary. `to-do-list.md` is stale — it describes a prior
datasources/repositories architecture that no longer exists in `src/`; ignore it.

## Commands

```bash
npm run start:dev      # dev server, watch mode
npm run build           # nest build
npm run start:prod      # run compiled dist/main
npm run lint             # eslint --fix over src/apps/libs/test
npm run format            # prettier --write over src/ and test/
npm run test               # unit tests (jest)
npm run test:watch
npm run test:cov
npm run test:e2e           # e2e tests (separate jest config: test/jest-e2e.json)
npx prisma migrate dev    # apply/create a Postgres migration (see prisma/migrations/)
```

Run a single unit test file (Jest `rootDir` is `src`, so pass a name that matches the `.spec.ts`
path/filename, not a project-root-relative path):

```bash
npm test -- confirm-payment.use-case
npm test -- src/modules/billing/use-cases/confirm-payment.use-case.spec.ts
```

Every controller, use case, adapter and domain service has its `.spec.ts` next to the file it tests.

## Architecture

The structure follows `../doc/product/refactor.md` (modules, ports, routes) and
`../doc/product/use-cases.md` (one class per use case, shared rules R1–R7). Read both before adding a
module or an endpoint.

```
src/
├── domain/                    # Pure business rules, no NestJS/SDK dependencies
│   ├── ports/                  # Abstract classes used as Nest injection tokens: LlmProvider, FileStorage,
│   │                            # EmailSender, PlanDocumentRenderer
│   ├── dtos/                   # Shared data interfaces + identity-auth/clinical-domain/commercial-domain Create*/Update*Dto
│   ├── entities/                # Plain TS interfaces mirroring prisma/schema.prisma (*Entity suffix)
│   ├── datasources/ repositories/  # Abstract persistence contracts per entity (use cases depend on repositories/)
│   └── services/
│       ├── formulas/            # TMB, GET, requirements, body composition, somatocarta, supplements...
│       ├── alimentos/           # Food exchange-portion table
│       └── utils/                # Age, predefined plan codes, S3 keys (storage-keys.ts)
├── infrastructure/             # Adapters: implement domain/ports and domain repositories
│   ├── persistence/            # orm/prisma (PrismaService, global), datasources/ (Prisma impls), repositories/ (thin delegation)
│   ├── llm/openai/             # OpenaiLlmProvider -> LlmProvider (LlmModule)
│   ├── storage/s3/             # S3FileStorage -> FileStorage (FileStorageModule)
│   ├── email/                  # LogEmailSender -> EmailSender (EmailModule; stub, logs only)
│   ├── pdf/                    # ReactPdfPlanDocumentRenderer -> PlanDocumentRenderer (PDF + WebP thumbnail)
│   └── auth/cognito/           # getCognitoVerifier() (aws-jwt-verify)
├── common/                     # CognitoAuthGuard, @CognitoUser(), HttpExceptionFilter, API_PREFIX
├── modules/                    # NestJS business modules
│   ├── identity/               # /me, /me/sync, /me/summary; exports CurrentUserResolver
│   ├── consultation/           # /consultations/chat, /consultations
│   ├── plans/                  # /plans/standard/*, /me/plans, plan generation (listener of order.paid)
│   ├── billing/                # /orders/:id/status, /webhooks/payments, /dev/orders/:id/simulate-payment;
│   │                            # exports CreateOrderUseCase + OrderLifecycleService, emits order.paid
│   └── clinical/               # patient history: /me/consultations (measurements pending); reads order
│                                # statuses via the consultation repository (no billing import)
├── app.module.ts
└── main.ts                     # app.setGlobalPrefix('api/v1'), Swagger at /api-docs (outside the prefix)
```

Inside each module: `<resource>.controller.ts` (HTTP ↔ one use case, no logic), `dto/` (validated
`*Impl` classes implementing the plain interfaces in `domain/dtos`), `use-cases/<verb>-<resource>.use-case.ts`
(class `VerbResourceUseCase` with a single public `execute(input)`), and `listeners/` for use cases
triggered by events. Don't add `XxxService` god-classes; if two use cases share logic, extract a
domain service or an internal use case (e.g. `CreateOrderUseCase`).

**Dependency rules (important):**

- `domain/` never imports from `modules/`, `infrastructure/` or `common/`. Use cases depend on
  `domain/ports`, never on the OpenAI/S3 SDKs or the concrete adapters; specs mock the port.
- Between modules: `consultation`/`plans`/`clinical` → `billing` → nothing (`clinical` doesn't import it today); everyone may use `identity` only for
  `CurrentUserResolver`. `billing` never imports `plans`: it emits `order.paid`
  (`modules/billing/events/order-paid.event.ts`, `@nestjs/event-emitter` v3 — v12 is ESM-only and breaks
  Jest) and `plans/listeners/order-paid.listener.ts` reacts.
- Only `billing` writes `order`/`payment`. New orders go through `CreateOrderUseCase`; generation state
  transitions through `OrderLifecycleService`.

**Route conventions:** every route lives under `/api/v1`, uses English plural nouns
(`POST /consultations`, not `/create-consultation`), and everything that belongs to the authenticated
user lives under `/me` (the user always comes from the token via `CurrentUserResolver.resolve`, never
from a body/URL id — R1). A route with an id must filter by the user too and answer 404 for both
"missing" and "not yours" (R2). The frontend (`../nutricionista-virtual-front`) calls these routes
through `apiFetch`, which adds the `api/v1` prefix — a route change is a coordinated back + front change.

### Request/response flow

0. `POST /me/sync` — creates `AuthIdentity` + skeleton `User` for the Cognito `sub` (idempotent), called
   by the frontend's login callback. `PATCH /me` completes the profile (single DTO, all fields optional,
   including `athlete`). See `doc/auth.md`.
1. `POST /consultations/chat` — one call per chat turn (`ChatAnamnesisUseCase`). Builds a system prompt
   (`modules/consultation/prompts/anamnesis-chat.prompt.ts`) describing the full `AnamnesisDto` schema and
   current fill-state, calls the LLM, normalizes the model's JSON (`dto/anamnesis-normalizer.ts`) and
   **recomputes `isComplete` on the server** rather than trusting the model.
2. `POST /consultations` (`CreateConsultationUseCase`, requires a **complete** profile — 400 otherwise)
   — resolves the user and their `ClinicalRecord`, the active `GENERATED` `Product`, creates the `Order`
   through billing's `CreateOrderUseCase` (`paymentStatus='PENDING'`), and persists the full
   `NutritionalConsultation` (with `orderId`) + `Anamnesis`/`Measurements` in one nested Prisma write
   (`consultation.mapper.ts`). Order and consultation are two separate writes (no shared transaction yet).
   `personalInfo` is still required by the contract but not read.
3. Payment (`POST /webhooks/payments` or the simulated `POST /dev/orders/:id/simulate-payment`, enabled
   only with `ENABLE_PAYMENT_SIMULATION=true`) → `ConfirmPaymentUseCase` marks the order paid
   **idempotently** (+ `payment` row, same transaction; for `PREDEFINED` products it also copies the PDF
   keys and completes the order) and emits `order.paid` only if this call marked it. It responds
   immediately (`processed` | `already_processed`).
4. `OrderPaidListener` runs `GeneratePersonalizedPlanUseCase` fire-and-forget for `GENERATED` products:
   rebuilds the consultation by `order_id` → classifies activity level/objective via the LLM → computes
   energy/macro requirements and supplements **without AI** → asks the LLM for the plan using those numbers
   verbatim, as exchange-group portions (validated in code) → retries up to 4x with exponential backoff →
   renders PDF + thumbnail, uploads to S3, upserts `Plan` + main `NutritionalPlan`, completes the order
   (`planJson`, `pdfKey`, `thumbnailKey`) and emails the PDF.
5. `GET /orders/:id/status` (`GetOrderStatusUseCase`) — polling endpoint; validates ownership (404 for
   missing or foreign orders). `GET /me/plans` lists the user's ready plans.

`LlmProvider.chatJson<T>` is the single point of access to the model: `OpenaiLlmProvider` calls
`chat.completions.create` with `response_format: json_object` and returns the parsed result. Each use
case passes its own model (env-driven, with fallbacks) — `OPENAI_MODEL_CONSULTA` for the chat (cheap
model, no payment gate) vs `OPENAI_MODEL_PLAN` for generation (paid gate; this model only accepts the
default `temperature=1` — passing any other value causes a 400).

### Domain formulas

`domain/services/formulas/requerimientos.service.ts` computes TMB (Harris-Benedict for 18+,
FAO/OMS/UNU for minors) → GET (TMB adjusted for activity + thermogenesis) → energy/macro targets
based on `objetivo` (`definicion` | `mantencion` | `volumen`). `suplementos.service.ts` computes a
supplement prescription from weight alone. Both are computed once in `GeneratePersonalizedPlanUseCase` and handed
to the AI as fixed inputs it must not recalculate.

Several other formula services exist (BMI, skinfolds, muscle mass, body fat %, phantom, IMM,
corrected perimeters, somatocarta, sports-session expenditure) but are **not yet wired into the
plan-generation flow** — only weight and height (`peso`/`talla`) from `MedicionesDto` are currently
used. See the README's "Deuda técnica" section and `doc/technical-debt.md` before assuming any of
these are live.

`domain/services/alimentos/porciones-alimentos.ts` defines the food-exchange portion table used by
the plan-generation prompt to tell the AI the nutritional value per portion of each food group.

### Persistence

**Postgres**, via a full domain schema (`prisma/schema.prisma`, 35 models across three sections —
`IDENTITY & AUTH`, `CLINICAL DOMAIN`, `COMMERCIAL DOMAIN`). The old single-model SQLite setup (one
`Order`, tables `orden`) is gone — that legacy model is left commented out in the schema for
reference only, and its table was dropped. Closed-value columns (`Order.paymentStatus`/`generationStatus`,
`Payment.provider`/`status`, `Product.type`, `SportsSession.eventType`, `Measurements.level`,
`NutritionalPlan.period`, `PlanMealTime.time`, ...) are **native Postgres enums** (`enum` blocks in
`schema.prisma`), mirrored in the domain as `as const` objects + union types in
`domain/entities/enums.ts` — use those constants (`PaymentStatus.PAID`, `GenerationStatus.COMPLETED`)
instead of string literals. Order statuses are English (`PENDING|PAID`,
`NOT_STARTED|GENERATING|COMPLETED|ERROR`) and that's also what `GET /orders/:id/status` returns.

Only part of this schema has a real consumer today — the consultation → billing → plan-generation
pipeline uses `User`, `ClinicalRecord`, `NutritionalConsultation` (+ its `Anamnesis`/`Measurements`
children), `Plan` + `NutritionalPlan` (`GeneratePersonalizedPlanUseCase` upserts the order's `Plan` by `orderId`
— `Plan.orderId` is `@unique`, 1 order → 1 plan — together with its main `NutritionalPlan`
(`mainPlan = true`) before marking the order `COMPLETED`; a `Plan` can hold N `NutritionalPlan`s,
though only one is created today, together with its child tables `PlanMealTime` (+ notes, numeric
portions from the calculation), `PlanSupplement` (one row per supplement, + notes) and
`PlanSportsRecommendation` — see `modules/plans/generation/plan-generation.mapper.ts`; children are
replaced via `ON DELETE CASCADE` on retries), `Order`, and `Product`;
`AuthIdentity` is used by `modules/identity/` (see below). The
rest (`Projection`, several `clinical-domain` leaf entities)
exists as fully-built domain/infrastructure code (entities, DTOs, datasources, repositories — see
the `domain/`/`infrastructure/` tree above) but is not wired into any endpoint yet. `Payment` is
written by the payment webhook (`OrderRepository.markOrderAsPaidWithPayment`, same transaction that
marks the order paid; `provider = 'SIMULATED'` while the gateway is simulated). See
`doc/postgres-domain-groundwork.md` for the full architecture of that layer and
`doc/orders-postgres-migration.md` for exactly what got connected and why.

**Predefined plans** (a second product type, `Product.type = 'PREDEFINED'`, 112 versions identified by
`Product.code` — `<plan>-<minKg>-<maxKg>-<m|f>-<joven|adulto>`, see
`domain/services/utils/predefined-plan-code.ts`): the PDF already exists in S3
(`productos-estandarizados/<code>.pdf`), uploaded by hand, and `npm run seed:predefined` loads/activates
the catalog. `POST /plans/standard/:code/purchase` creates the order **without** `pdfKey`; payment confirmation copies
`Product.pdfKey`/`thumbnailKey` to the order (and marks it `COMPLETED`) only when payment is confirmed,
so an unpaid order never exposes the PDF, and it does **not** run plan generation for these. Full flow:
`../doc/flows/purchase-flow-predefined-plan.md`.

**Login/registration is implemented** with Amazon Cognito (Hosted UI, native + Google as a
federated Identity Provider) — see `doc/auth.md` for the full picture. `common/auth/CognitoAuthGuard` (with
`infrastructure/auth/cognito`) validates the Cognito Access Token
(`aws-jwt-verify` against the User Pool's JWKS) and resolves/creates `AuthIdentity`+`User` by the
token's `sub` (`CurrentUserResolver`, `modules/identity/`) — `POST /me/sync` creates the identity ("skeleton" `User`, no password ever
stored) as soon as there's a valid session, and `PATCH /me` completes the profile
(`firstName`/`paternalLastName`/`gender`/`dateOfBirth`, all nullable in the schema for exactly this
reason, plus the optional `athlete` flag, which lives on `User`) separately, since Cognito never provides those fields. `JWT_ACCESS_SECRET`/
`JWT_REFRESH_SECRET`/`BCRYPT_SALT_OR_ROUNDS` in `.env.template` are still leftovers from an
unrelated, removed local-auth module — `COGNITO_USER_POOL_ID`/`COGNITO_CLIENT_ID` are the ones
actually used by the Guard.

There is no data-retention job: orders (`Order.planJson`), consultations and `NutritionalPlan` rows
are kept indefinitely (the former 45-day `RetentionService` cron was removed). If a retention policy
is needed later, it must cover `Plan`/`NutritionalPlan` too.

## Keeping documentation in sync

After making a large or structurally significant change — a new/removed module, a new/removed
endpoint, a change to the plan-generation pipeline, a Prisma schema change, a mass rename/refactor
of the kind this repo has had before — invoke the `doc-updater` subagent (Agent tool,
`subagent_type: "doc-updater"`) before considering the task done, so it updates `README.md` and/or
`doc/` to match. Don't rely on hooks for this; it's a step you take yourself as part of finishing
the task. Skip it for small/internal changes with no observable impact on architecture, endpoints,
or documented flows.

## Keeping tests in sync

This repo has a real test suite now (`*.spec.ts` co-located under `src/`, e2e under `test/` — see
`doc/testing.md` for scope, coverage, and the mocking patterns established). After modifying a
file that already has a `.spec.ts`, or adding a new service/function to the core pipeline
(consultation → billing → plans generation, and wired-in domain formulas), invoke the `test-updater`
subagent (Agent tool, `subagent_type: "test-updater"`) before considering the task done, so it
updates/adds the relevant tests and confirms they pass. Skip it for changes to code that has no
test coverage by design (see `doc/testing.md §7` — dead formulas, `ReactPdfPlanDocumentRenderer`, prompt builders)
unless the user asks to expand coverage there.

## Stubs / not-yet-real integrations

Be aware these are intentionally fake right now — don't assume they behave like production
integrations when reasoning about behavior or writing tests:

- `ConfirmPaymentUseCase.verifyWebhookSignature()` always returns `true` — no real payment gateway
  signature validation.
- `LogEmailSender.sendRealEmail()` only logs — no real email provider wired.
- Payments are simulated: `POST /dev/orders/:id/simulate-payment` (behind `ENABLE_PAYMENT_SIMULATION`)
  is the only payment path until Transbank is integrated; `payment.provider = 'SIMULATED'`.
