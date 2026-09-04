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
npx prisma migrate dev    # apply/create the SQLite migration (prisma/dev.db)
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
│   ├── dtos/                   # Shared data interfaces (Anamnesis, Consulta, Plan, Orden)
│   └── services/
│       ├── formulas/            # TMB, GET, requirements, body composition, somatocarta, supplements...
│       ├── alimentos/           # Food exchange-portion table
│       └── utils/                # Small helpers (age calculation, etc.)
├── infrastructure/
│   └── orm/prisma/              # PrismaService/PrismaModule (SQLite, WAL mode)
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

**Naming split (important, easy to get wrong):** a recent refactor renamed folders/classes/services
to English (`presentation/orders`, `OrdersService`, `presentation/consultation`, etc.), but the
**HTTP route paths and JSON payload field names deliberately stayed in Spanish**
(`/consulta/chat`, `/ordenes/crear`, `estado_pago`, `payload_json`, the `orden` Prisma table via
`@map`, ...). Don't "fix" this mismatch — it's intentional, matching the frontend contract. When
adding code, follow the pattern already in that file/module rather than assuming one convention
applies everywhere.

### Active module chain (`app.module.ts`)

`PrismaModule`, `ConsultationModule`, `OpenaiModule`, `OrdersModule`, `WebhooksModule` — the last
imports `PlanGenerationModule`, which imports `NotificationsModule` → `PdfModule`. Together these
form the pipeline: payment confirmed → plan generated → PDF rendered → email sent.

### Request/response flow

1. `POST /consulta/chat` — one call per chat turn. Builds a system prompt describing the full
   `AnamnesisDto` schema and current fill-state, calls OpenAI, normalizes the model's JSON
   (`anamnesis-normalizer.ts` repairs common LLM shape drift, e.g. `r24h` must be a flat array of
   per-meal objects), and **recomputes `isComplete` on the server** rather than trusting the model.
2. `POST /ordenes/crear` — persists the order (`estado_pago='pendiente'`, no AI call yet).
3. Payment webhook (`POST /webhooks/pago` or the simulated `POST /webhooks/ordenes/:id/simular-pago`)
   marks the order paid **idempotently**, then fires `PlanGenerationService.generarPlan` without
   awaiting it (fire-and-forget) — the webhook responds immediately.
4. Plan generation (background, no HTTP endpoint): classifies activity level/objective via OpenAI →
   computes energy/macro requirements and supplements **without AI** (pure domain formulas) →
   asks OpenAI to generate the plan using those precomputed numbers verbatim, expressing food as
   portions from the exchange-group table (not free-form quantities) → retries up to 4x with
   exponential backoff → persists `plan_json` and emails it.
5. `GET /ordenes/obtener-estado/:id` — polling endpoint the frontend uses to check
   `estado_generacion` and fetch `plan_json` once ready.

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

Single Prisma model, `Order` (mapped to SQLite table `orden` via `@map`/`@@map`) — see
`prisma/schema.prisma`. There is no user/professional/auth model connected to any endpoint today;
env vars for JWT/bcrypt in `.env.template` are leftovers from a removed auth module. SQLite has no
native enums, so `paymentStatus`/`generationStatus` are plain strings typed at the application layer
(`domain/dtos/order.dto.ts`).

A daily cron (`RetencionService`, 03:00) anonymizes `payload_json`/`plan_json` on orders older than
45 days while keeping the row (`OrdersService.limpiarOrdenesAntiguas`).

## Keeping documentation in sync

After making a large or structurally significant change — a new/removed module, a new/removed
endpoint, a change to the plan-generation pipeline, a Prisma schema change, a mass rename/refactor
of the kind this repo has had before — invoke the `doc-updater` subagent (Agent tool,
`subagent_type: "doc-updater"`) before considering the task done, so it updates `README.md` and/or
`doc/` to match. Don't rely on hooks for this; it's a step you take yourself as part of finishing
the task. Skip it for small/internal changes with no observable impact on architecture, endpoints,
or documented flows.

## Stubs / not-yet-real integrations

Be aware these are intentionally fake right now — don't assume they behave like production
integrations when reasoning about behavior or writing tests:

- `WebhooksService.verificarFirmaWebhook()` always returns `true` — no real payment gateway signature
  validation.
- `EmailService.enviarCorreoReal()` only logs — no real email provider wired.
