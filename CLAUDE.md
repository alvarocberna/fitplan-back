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
npm test -- orders.service
npm test -- src/presentation/webhooks/webhooks.service.spec.ts
```

Each `presentation/<module>` folder has its `.spec.ts` files (controller + service) next to the
code they test.

## Architecture

Layered structure under `src/`, with a strict one-way dependency: `domain/` never imports from
`presentation/`.

```
src/
├── domain/                    # Pure business rules, no NestJS dependencies
│   ├── dtos/                   # Legacy: shared data interfaces (Anamnesis, Consulta, Plan, Orden)
│   │                            # + identity-auth/clinical-domain/commercial-domain: Create*/Update*Dto per entity
│   ├── entities/                # Plain TS interfaces mirroring prisma/schema.prisma (33 entities, *Entity suffix)
│   ├── datasources/              # Abstract classes, CRUD contracts per entity (identity-auth/clinical-domain/commercial-domain)
│   ├── repositories/              # Same shape as datasources/, one layer up (services depend on these, not on datasources/)
│   └── services/
│       ├── formulas/            # TMB, GET, requirements, body composition, somatocarta, supplements...
│       ├── alimentos/           # Food exchange-portion table
│       └── utils/                # Small helpers (age calculation, etc.)
├── infrastructure/
│   ├── orm/prisma/              # PrismaService/PrismaModule (Postgres)
│   ├── datasources/              # Prisma-backed impls of domain/datasources/** (identity-auth, clinical-domain, commercial-domain)
│   └── repositories/             # Thin delegation layer over infrastructure/datasources/** (domain/repositories/** impls)
├── presentation/                # NestJS modules (controllers, services, validated DTOs)
│   ├── consultation/              # Conversational anamnesis-collection chat
│   ├── orders/                     # Order creation/status + data-retention cron job
│   ├── webhooks/                   # Payment webhook (real + simulated) → triggers plan generation
│   ├── plan-generation/            # Background worker that generates the plan with AI
│   ├── pdf/                         # Plan PDF rendering (@react-pdf/renderer)
│   ├── notifications/               # Emails the plan (stub — logs only, no real provider wired)
│   ├── openai/                      # Thin OpenAI SDK wrapper, shared by consultation + plan-generation
│   └── filters/                     # Global HttpExceptionFilter
├── app.module.ts
└── main.ts
```

DTOs in `presentation/**/dto` (the `*Impl` classes, decorated with `class-validator`) implement the
plain interfaces declared in `domain/dtos`.

**Naming split (important, easy to get wrong):** HTTP route paths (and a couple of leftover DTO
field names, e.g. `orden_id` in the payment webhook body) **deliberately stayed in Spanish**
(`/consulta/chat`, `/ordenes/crear`, `/ordenes/obtener-estado/:id`, `/webhooks/pago`,
`/webhooks/ordenes/:id/simular-pago`) even though folders/classes/services/JSON field names are in
English (`presentation/orders`, `OrdersService`, `paymentStatus`, `personalInfo`, ...). Don't "fix"
this mismatch — it's intentional, matching the frontend contract. The Postgres schema introduced by
the `orders`/`plan-generation` migration (see below) is named entirely in English end to end
(`payment_status`, `nutritional_consultation`, ...) — there's no more Spanish/English split at the
DB layer, only at the HTTP route level.

### Active module chain (`app.module.ts`)

`PrismaModule`, `ConsultationModule`, `OpenaiModule`, the 6 domain-layer infrastructure modules
(`IdentityAuthDatasourcesModule`/`IdentityAuthRepositoriesModule`,
`ClinicalDomainDatasourcesModule`/`ClinicalDomainRepositoriesModule`,
`CommercialDomainDatasourcesModule`/`CommercialDomainRepositoriesModule`), `OrdersModule`,
`WebhooksModule` — the last imports `PlanGenerationModule`, which imports `NotificationsModule` →
`PdfModule`. Together these form the pipeline: payment confirmed → plan generated → PDF rendered →
email sent. See `doc/orders-postgres-migration.md` for exactly what changed when the domain-layer
modules got wired in (they used to be built but unused, not registered anywhere).

### Request/response flow

1. `POST /consulta/chat` — one call per chat turn. Builds a system prompt describing the full
   `AnamnesisDto` schema and current fill-state, calls OpenAI, normalizes the model's JSON
   (`anamnesis-normalizer.ts` repairs common LLM shape drift, e.g. `r24h` must be a flat array of
   per-meal objects), and **recomputes `isComplete` on the server** rather than trusting the model.
2. `POST /ordenes/crear` — resolves (find-or-create) the `User` by email and their `ClinicalRecord`,
   resolves (find-or-create) a `Product`, creates the `Order` (`paymentStatus:'pendiente'`, no AI
   call yet), and persists the full `NutritionalConsultation` (`Anamnesis`/`Measurements` + their
   children) in one nested Prisma write — see `doc/orders-postgres-migration.md` for the exact
   DTO→entity mapping decisions. The HTTP request/response shape is unchanged from before this
   migration.
3. Payment webhook (`POST /webhooks/pago` or the simulated `POST /webhooks/ordenes/:id/simular-pago`)
   marks the order paid **idempotently**, then fires `PlanGenerationService.generatePlan` without
   awaiting it (fire-and-forget) — the webhook responds immediately.
4. Plan generation (background, no HTTP endpoint): reconstructs the same `CompleteConsultationDto`
   shape from the `Order`'s linked `NutritionalConsultation` (not from a stored JSON blob — that's
   gone) → classifies activity level/objective via OpenAI → computes energy/macro requirements and
   supplements **without AI** (pure domain formulas) → asks OpenAI to generate the plan using those
   precomputed numbers verbatim, expressing food as portions from the exchange-group table (not
   free-form quantities) → retries up to 4x with exponential backoff → persists `Order.planJson` and
   emails it.
5. `GET /ordenes/obtener-estado/:id` — polling endpoint the frontend uses to check
   `generationStatus` and fetch `planJson` once ready (response shape unchanged).

`OpenaiService.chatJson<T>` (`presentation/openai/openai.service.ts`) is the single point of access
to the OpenAI SDK for the whole backend; `chat.completions.create` is called with
`response_format: json_object` and the parsed result is returned typed. Model selection: each
caller passes its own model (env-driven, with fallbacks) — `OPENAI_MODEL_CONSULTA` for the chat
(cheap model, no payment gate) vs `OPENAI_MODEL_PLAN` for generation (paid gate; this model only
accepts the default `temperature=1` — passing any other value causes a 400).

### Domain formulas

`domain/services/formulas/requerimientos.service.ts` computes TMB (Harris-Benedict for 18+,
FAO/OMS/UNU for minors) → GET (TMB adjusted for activity + thermogenesis) → energy/macro targets
based on `objetivo` (`definicion` | `mantencion` | `volumen`). `suplementos.service.ts` computes a
supplement prescription from weight alone. Both are computed once in `plan-generation` and handed
to the AI as fixed inputs it must not recalculate.

Several other formula services exist (BMI, skinfolds, muscle mass, body fat %, phantom, IMM,
corrected perimeters, somatocarta, sports-session expenditure) but are **not yet wired into the
plan-generation flow** — only weight and height (`peso`/`talla`) from `MedicionesDto` are currently
used. See the README's "Deuda técnica" section and `doc/technical-debt.md` before assuming any of
these are live.

`domain/services/alimentos/porciones-alimentos.ts` defines the food-exchange portion table used by
the plan-generation prompt to tell the AI the nutritional value per portion of each food group.

### Persistence

**Postgres**, via a full domain schema (`prisma/schema.prisma`, 33 models across three sections —
`IDENTITY & AUTH`, `CLINICAL DOMAIN`, `COMMERCIAL DOMAIN`). The old single-model SQLite setup (one
`Order`, tables `orden`) is gone — that legacy model is left commented out in the schema for
reference only, and its table was dropped. Postgres has no native enums either, so "enum" columns
(`Order.paymentStatus`, `SportsSession.eventType`, etc.) are plain strings typed as literal unions
at the application layer (`domain/entities/*.entity.ts`).

Only part of this schema has a real consumer today — the `orders`/`webhooks`/`plan-generation`
pipeline uses `User`, `ClinicalRecord`, `NutritionalConsultation` (+ its `Anamnesis`/`Measurements`
children), `Order`, and `Product`. The rest (`AuthIdentity`, `Payment`, `NutritionalPlan` and its
children, several `clinical-domain` leaf entities) exists as fully-built domain/infrastructure code
(entities, DTOs, datasources, repositories — see the `domain/`/`infrastructure/` tree above) but is
not wired into any endpoint yet. See `doc/postgres-domain-groundwork.md` for the full architecture
of that layer and `doc/orders-postgres-migration.md` for exactly what got connected and why.

There is still no login/registration flow: `OrdersService.createOrder` resolves a `User` via
find-or-create by email (no password, no session). Env vars for JWT/bcrypt in `.env.template` are
leftovers from a removed auth module, unrelated to this `User` model.

A daily cron (`RetentionService`, 03:00) anonymizes `Order.planJson` on orders older than 45 days
while keeping the row (`OrdersService.cleanupOldOrders`) — it does not yet anonymize the clinical
data in `NutritionalConsultation`/`Anamnesis`/`Measurements` (see `doc/technical-debt.md`).

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
(`orders`→`webhooks`→`plan-generation` and wired-in domain formulas), invoke the `test-updater`
subagent (Agent tool, `subagent_type: "test-updater"`) before considering the task done, so it
updates/adds the relevant tests and confirms they pass. Skip it for changes to code that has no
test coverage by design (see `doc/testing.md §7` — dead formulas, `PdfService`, prompt builders)
unless the user asks to expand coverage there.

## Stubs / not-yet-real integrations

Be aware these are intentionally fake right now — don't assume they behave like production
integrations when reasoning about behavior or writing tests:

- `WebhooksService.verifyWebhookSignature()` always returns `true` — no real payment gateway
  signature validation.
- `EmailService.sendRealEmail()` only logs — no real email provider wired.
