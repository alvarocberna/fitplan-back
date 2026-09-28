# Suite de tests — Fase 1 (pipeline core)

Hasta esta fase el proyecto no tenía tests reales: solo existían 3 `*.spec.ts` generados por el
scaffolding de Nest CLI (`consultation.service.spec.ts`, `consultation.controller.spec.ts`,
`openai.service.spec.ts`), que únicamente verificaban `should be defined` sin mockear
dependencias — uno de ellos (`consultation.controller.spec.ts`) ni siquiera compilaba
correctamente su grafo de DI (instanciaba `ConsultationService` real sin proveerle su dependencia
`LlmProvider`). Este documento describe la suite agregada: qué cubre, cómo correrla, y las
decisiones de infraestructura que hicieron falta para que corriera.

Si buscas la arquitectura general del proyecto o el flujo end-to-end, ver el README principal y
`doc/flow-happy-path.md`. Este documento es específico de testing.

## 1. Alcance de esta fase

Se priorizó el **pipeline core**: la infraestructura de testing en sí, las fórmulas de dominio que
están efectivamente conectadas a un endpoint (`plan-generation`), y los servicios de
`modules/` que arman el flujo `POST /consultations` → webhook de pago → generación del plan.

**Fuera de esta fase** (deuda pendiente, ver §6): las 8 fórmulas de `domain/services/formulas/`
que hoy no tiene ningún consumidor real (`bmi.service.ts`, `body-fat.service.ts`,
`corrected-girths.service.ts`, `muscle-mass.service.ts`, `muscle-mass-index.service.ts`,
`skinfold-sum.service.ts`, y los archivos vacíos `phantom.service.ts`/`somatochart.service.ts`).

## 2. Cómo correr los tests

```bash
npm test              # unitarios (Jest, config inline en package.json)
npm run test:watch
npm run test:cov       # unitarios + reporte de cobertura
npm run test:e2e       # e2e (Jest, config en test/jest-e2e.json)
```

Cada módulo de `src/modules/**` y `src/domain/services/**` trae su(s) `*.spec.ts`
co-localizado(s) junto al archivo que testea — mismo patrón que ya usaba el scaffolding original,
ahora con cobertura real. Jest (`rootDir: src`) solo descubre `*.spec.ts` bajo `src/`; el e2e vive
aparte, en `test/*.e2e-spec.ts`.

Correr un archivo puntual (Jest `rootDir` es `src`, así que el patrón no incluye ese prefijo):

```bash
npm test -- confirm-payment.use-case
npm test -- src/domain/services/formulas/requirements/requirements.service.spec.ts
```

## 3. Infraestructura de testing (cambios en `package.json` / `test/`)

Al escribir estos tests aparecieron dos gaps reales en el setup de Jest que no tenían que ver con
lógica de negocio, sino con que Jest no podía ni siquiera **cargar** ciertos módulos:

- **`.tsx` no reconocido**: `react-pdf-plan-document.renderer.tsx`/`nutrition-plan.document.tsx` (`infrastructure/pdf/`)
  son `.tsx`, pero `moduleFileExtensions`/`transform` del jest config original solo cubrían
  `.ts`/`.js`. Se agregó `"tsx"` a `moduleFileExtensions` y se amplió el regex de `transform` a
  `^.+\.(t|j)sx?$` (en `package.json` y en `test/jest-e2e.json`).
- **`@react-pdf/renderer` es ESM puro**: el paquete (y varias de sus dependencias internas) solo se
  publica como ESM, que ts-jest no puede transformar tal cual — cualquier test que tocara
  (aunque sea transitivamente, vía DI) el renderer de PDF o `GeneratePersonalizedPlanUseCase`
  fallaba con `SyntaxError: Cannot use import statement outside a module`. Se agregó un
  `moduleNameMapper` (`^@react-pdf/renderer$` → `test/mocks/react-pdf-renderer.ts`) que reemplaza
  el paquete completo por componentes inertes + un `renderToBuffer` mockeado (`jest.fn()`
  resuelto a un `Buffer` vacío) — los tests nunca necesitan un PDF real, solo verificar que se
  invoque con los datos correctos.

El stub vive en `test/mocks/` y se referencia desde los dos jest config (`package.json` para
unitarios, `test/jest-e2e.json` para e2e) con rutas relativas a cada `rootDir` respectivo.

Como parte de esto también se eliminó código muerto que interfería con testear
`portion-adequacy.service.ts`: el archivo ejecutaba, a nivel de módulo (fuera de cualquier
función), una llamada de prueba (`calculateFoodsAndIntake(...)` + `console.log(...)`) contra
fixtures de `domain/services/objects/` — corría cada vez que Jest importaba el archivo. Se quitó
junto con los imports que quedaron sin uso.

## 4. Qué cubre cada test

### Fórmulas de dominio (`domain/services/**`) — funciones puras, sin DI

| Archivo | Test | Foco |
|---|---|---|
| `utils/age.service.ts` | `age.service.spec.ts` | cumpleaños pasado/no pasado, hoy, año bisiesto |
| `formulas/requirements/requirements.service.ts` | `requirements.service.spec.ts` | BMR Mifflin/Carrasco/FAO-OMS-UNU, ramas de `goal` (`definicion`/`volumen`/`mantencion`), athlete+somatotype, invariante calorías=macros |
| `formulas/requirements/supplements.service.ts` | `supplements.service.spec.ts` | las 4 prescripciones (creatina/cafeína/nitrato/bicarbonato), escalado por peso |
| `formulas/requirements/sport-session.service.ts` | `sport-session.service.spec.ts` | catálogo `SPORT_SESSIONS`, recomendación por código y fallback |
| `alimentos/meal-times.service.ts` | `meal-times.service.spec.ts` | completado de tiempos de comida (1→3+colación, 4+volumen, preservación de reportados) |
| `alimentos/portion-adequacy.service.ts` | `portion-adequacy.service.spec.ts` | `defineFoodGroups` (reglas de eliminación por tiempo de comida) + un escenario de `calculateFoodsAndIntake`/`calculateTotalPlanIntake`/`calculateTotalAdequacy` **trazado a mano y verificado contra el algoritmo real** (test de regresión "congelado": si el algoritmo cambia, este test detecta el cambio de números) |
| `alimentos/food-portions.ts` | `food-portions.spec.ts` | `findFoodGroup` (caso válido / lanza si no existe) |

### `modules/`, `infrastructure/` y `common/`

Tras el refactor (ver `../doc/product/refactor.md`), la lógica de aplicación vive en casos de uso
(`modules/<módulo>/use-cases/*.use-case.ts`); cada uno se testea instanciándolo con sus dependencias
mockeadas (puertos, repositorios, `CurrentUserResolver`), y cada controller solo verifica que delega en
su caso de uso con los argumentos correctos.

| Archivo | Test | Mockea / foco |
|---|---|---|
| `identity/current-user.resolver.ts` | `current-user.resolver.spec.ts` | repositorios de identidad: `sub` → `AuthIdentity` → `User`, 401 sin identidad, `isProfileComplete` |
| `identity/use-cases/sync-identity` | `sync-identity.use-case.spec.ts` | identidad existente vs. primera vez (User esqueleto + `AuthIdentity` primaria) |
| `identity/use-cases/get-my-profile` / `update-my-profile` | `*.use-case.spec.ts` | `CurrentUserResolver`, `UserRepository`: `ProfileDto` completo con `age`; PATCH parcial (solo campos presentes, `null` limpia) |
| `identity/use-cases/get-my-summary` | `get-my-summary.use-case.spec.ts` | `CurrentUserResolver`, `NutritionalConsultationRepository` — nombre completo, `lastConsultationDate`, `dietRegimen`, paciente sin consultas y consulta con relaciones vacías (`null` sin lanzar) |
| `identity/me.controller.ts` | `me.controller.spec.ts` | los 4 casos de uso |
| `consultation/use-cases/chat-anamnesis` | `chat-anamnesis.use-case.spec.ts` | `LlmProvider`: reintento con `reply` vacío, fallback, `isComplete` recalculado |
| `consultation/use-cases/create-consultation` | `create-consultation.use-case.spec.ts` | `CurrentUserResolver`, repositorios, `CreateOrderUseCase`: 400 sin `personalInfo` o con perfil incompleto, orden vía billing, consulta enlazada por `orderId`, numeración, `measuredAt` |
| `consultation/consultation.mapper.ts` | `consultation.mapper.spec.ts` | nada (funciones puras) |
| `consultation/consultations.controller.ts` | `consultations.controller.spec.ts` | los 2 casos de uso |
| `plans/use-cases/list-standard-plan-previews` / `get-standard-plan` | `*.use-case.spec.ts` | `ProductRepository`, `FileStorage`: no exponen `pdfKey`/`thumbnailKey`, 404 por código inválido o inactivo |
| `plans/use-cases/purchase-standard-plan` | `purchase-standard-plan.use-case.spec.ts` | `CreateOrderUseCase`: sin perfil completo ni consulta, 404 si no existe / inactivo / sin PDF / código inválido |
| `plans/use-cases/list-my-plans` | `list-my-plans.use-case.spec.ts` | `OrderRepository`, `FileStorage`: PDF firmado como attachment, miniatura opcional |
| `plans/use-cases/generate-personalized-plan` | `generate-personalized-plan.use-case.spec.ts` | `OrderLifecycleService`/`LlmProvider`/`EmailSender`/`PlanDocumentRenderer`/`FileStorage`/`PlanRepository`/`NutritionalConsultationRepository` (upsert del `Plan` antes de `completeGeneration`, reintentos) — **las fórmulas de dominio corren de verdad** (test híbrido); ver §5 |
| `plans/listeners/order-paid.listener.ts` | `order-paid.listener.spec.ts` | `GeneratePersonalizedPlanUseCase`: solo `GENERATED` genera; un error inesperado queda contenido |
| `plans/generation/plan-generation.mapper.ts` | `plan-generation.mapper.spec.ts` | nada (`NutritionPlanDto` → `NutritionalPlan`) |
| `plans/*.controller.ts` | `standard-plans.controller.spec.ts` | los casos de uso del catálogo y de `GET /me/plans` |
| `billing/use-cases/create-order` | `create-order.use-case.spec.ts` | `OrderRepository`: orden pendiente con monto/moneda del producto |
| `billing/use-cases/confirm-payment` | `confirm-payment.use-case.spec.ts` | `OrderRepository`, `EventEmitter2`: `payment` `AUTHORIZED`, copia del PDF para `PREDEFINED`, emite `order.paid` solo si marcó el pago, idempotencia |
| `billing/use-cases/get-order-status` | `get-order-status.use-case.spec.ts` | `CurrentUserResolver`, `OrderRepository`, `FileStorage`: 404 por orden ajena o inexistente (BOLA) |
| `billing/order-lifecycle.service.ts` | `order-lifecycle.service.spec.ts` | `OrderRepository` |
| `billing/*.controller.ts` + `PaymentSimulationEnabledGuard` | `orders.controller.spec.ts`, `payments.controller.spec.ts` | casos de uso; firma inválida → 401; el simulador responde 404 sin `ENABLE_PAYMENT_SIMULATION=true` |
| `domain/services/utils/predefined-plan-code.ts` / `storage-keys.ts` | `*.spec.ts` | nada (regex, las 112 combinaciones, keys de S3) |
| `scripts/predefined-products.seed-data.ts` | `predefined-products.seed-data.spec.ts` | nada (las 112 filas del seed con keys únicas). El runner `seed-predefined-products.ts` no tiene test |
| `infrastructure/llm/openai/openai-llm.provider.ts` | `openai-llm.provider.spec.ts` | el SDK `openai` (`jest.mock('openai', ...)`) |
| `infrastructure/storage/s3/s3-file-storage.ts` | `s3-file-storage.spec.ts` | `S3Client`/presigner: comandos `PutObject`/`GetObject`, `Content-Disposition` |
| `infrastructure/email/log-email-sender.ts` | `log-email-sender.spec.ts` | nada (recibe el PDF ya generado) |
| `common/filters/http-exception.filter.ts` | `http-exception.filter.spec.ts` | `ArgumentsHost` construido a mano |

`NutritionalConsultationRepository.getLatestNutritionalConsultationWithDetailsByPatientId` (y el resto
de `infrastructure/persistence/**`) no tiene spec propio: es pura delegación/Prisma sin lógica de
negocio. Los casos de uso mockean los repositorios en ese límite.

## 5. Patrones usados que vale la pena conocer antes de tocar estos tests

- **`GeneratePersonalizedPlanUseCase` es un test híbrido**: solo se mockean los bordes externos
  (`OrderLifecycleService`, `LlmProvider`, `EmailSender`, `PlanDocumentRenderer`, `FileStorage`);
  `calculateRequirements`, `determineMealTimes`,
  `defineFoodGroups`, `calculateFoodsAndIntake` corren de verdad. El test del caso feliz define un
  helper (`buildMatchingGeneratedMealTimes`) que arma una respuesta de IA "perfecta" **a partir del
  resultado real** de `calculateFoodsAndIntake` (usa `FOOD_GROUP_PORTIONS`/`FOOD_FIELD_TO_GROUP`
  para escalar alimentos reales exactamente a las porciones ya calculadas) — así el test no depende
  de tracear el algoritmo a mano, se mantiene válido aunque cambien los números exactos que produce
  `portion-adequacy.service.ts`, y ejercita de verdad `validateGeneratedExamples`/
  `validateGeneratedEquivalences`.
- **Reintentos con backoff**: el test de agotamiento de los 4 intentos usa
  `jest.useFakeTimers()` + `jest.advanceTimersByTimeAsync(...)` para no esperar los ~7s reales de
  backoff exponencial (`1000+2000+4000ms`).
- **Fire-and-forget**: `OrderPaidListener` dispara `GeneratePersonalizedPlanUseCase.execute()` sin
  `await`; el test que verifica que un error ahí queda contenido resuelve una promesa extra
  (`await new Promise((r) => setImmediate(r))`) para dejar correr el microtask antes de aserter.
- **`@nestjs/event-emitter` v3**: la v12 es solo ESM y Jest (CJS) no puede cargarla. No actualizarla
  sin configurar Jest para ESM.
- **`OpenaiLlmProvider`** construye su propio cliente `OpenAI` en el constructor
  (`new OpenAI({apiKey:...})`); se mockea el paquete completo (`jest.mock('openai', () => ...)`)
  en vez de intentar inyectar el cliente, ya que no hay una forma de override por DI para él.

## 6. e2e (`test/app.e2e-spec.ts`)

Bootstrapea `AppModule` completo (prefijo `/api/v1`, routing, `ValidationPipe`, `HttpExceptionFilter`,
casos de uso y evento `order.paid` reales) contra `supertest`, mockeando solo el límite bajo: los
repositorios, los puertos (`LlmProvider`, `EmailSender`, `PlanDocumentRenderer`, `FileStorage`),
`PrismaService` (no se levanta Postgres) y `CognitoAuthGuard` (con header `Authorization` el token se da
por válido con un `sub` fijo; sin él, 401). Cubre:

- Las rutas antiguas (en español y sin prefijo) responden 404.
- `GET /me` (200 y 401 sin token) y `PATCH /me` con body parcial.
- `POST /consultations` — payload válido (201 + `orderId`) y propiedad desconocida (400,
  `forbidNonWhitelisted`).
- `GET /orders/:id/status` — estado (200), id no-UUID (400), orden de otro usuario (404).
- `POST /webhooks/payments` — `processed` → `already_processed` (idempotencia), el evento `order.paid`
  dispara el listener de generación, `orderId` no-UUID (400).
- `POST /dev/orders/:id/simulate-payment` — 404 sin `ENABLE_PAYMENT_SIMULATION=true`; con el flag
  procesa el pago (un plan estándar no dispara la generación).

## 7. Deuda pendiente / Fase 2 (no incluida en esta pasada)

- **Fórmulas muertas sin test** (`bmi.service.ts`, `body-fat.service.ts`,
  `corrected-girths.service.ts`, `muscle-mass.service.ts`, `muscle-mass-index.service.ts`,
  `skinfold-sum.service.ts`) — no están conectadas a ningún endpoint hoy (ver
  `doc/technical-debt.md`), quedaron fuera de esta fase a propósito.
- **2 bugs reales detectados en esas fórmulas muertas, sin corregir** (decisión explícita: no tocar
  lógica clínica sin confirmación de un humano, dado que son fórmulas médicas):
  - `bmi.service.ts` → `getBmiClassification`: el caso `bmi >= 30` no tiene tope superior, así que
    intercepta cualquier IMC ≥30 antes de llegar a los casos `OBESITY_II`/`OBESITY_III`
    (`bmi >= 35`/`bmi >= 40`), que quedan **inalcanzables**.
  - `body-fat.service.ts` → `getBodyFatClassification`: el bloque `case age < 60:` (rama hombres)
    no tiene `break`, así que cae al bloque `case age >= 60:` y **sobreescribe** el resultado ya
    calculado — afecta a cualquier hombre entre 40 y 59 años.
- `test:e2e` pasa en local pero no corre en CI.
- No hay tests de `infrastructure/pdf` (`ReactPdfPlanDocumentRenderer`, `ThumbnailService`) ni de los
  prompts (`modules/consultation/prompts/**`, `modules/plans/generation/**`) (son generadores de texto para el prompt de la IA, sin lógica de
  negocio verificable más allá de "no revienta") — bajo valor, se dejaron fuera deliberadamente.
- `GET /me/plans`, `GET /me/summary` y el catálogo `/plans/standard/*` no tienen cobertura e2e (sí unitaria).
