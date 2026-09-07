# Suite de tests — Fase 1 (pipeline core)

Hasta esta fase el proyecto no tenía tests reales: solo existían 3 `*.spec.ts` generados por el
scaffolding de Nest CLI (`consultation.service.spec.ts`, `consultation.controller.spec.ts`,
`openai.service.spec.ts`), que únicamente verificaban `should be defined` sin mockear
dependencias — uno de ellos (`consultation.controller.spec.ts`) ni siquiera compilaba
correctamente su grafo de DI (instanciaba `ConsultationService` real sin proveerle su dependencia
`OpenaiService`). Este documento describe la suite agregada: qué cubre, cómo correrla, y las
decisiones de infraestructura que hicieron falta para que corriera.

Si buscas la arquitectura general del proyecto o el flujo end-to-end, ver el README principal y
`doc/flow-happy-path.md`. Este documento es específico de testing.

## 1. Alcance de esta fase

Se priorizó el **pipeline core**: la infraestructura de testing en sí, las fórmulas de dominio que
están efectivamente conectadas a un endpoint (`plan-generation`), y los servicios de
`presentation/` que arman el flujo `POST /ordenes/crear` → webhook de pago → generación del plan.

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

Cada módulo de `src/presentation/**` y `src/domain/services/**` trae su(s) `*.spec.ts`
co-localizado(s) junto al archivo que testea — mismo patrón que ya usaba el scaffolding original,
ahora con cobertura real. Jest (`rootDir: src`) solo descubre `*.spec.ts` bajo `src/`; el e2e vive
aparte, en `test/*.e2e-spec.ts`.

Correr un archivo puntual (Jest `rootDir` es `src`, así que el patrón no incluye ese prefijo):

```bash
npm test -- orders.service
npm test -- src/domain/services/formulas/requirements.service.spec.ts
```

## 3. Infraestructura de testing (cambios en `package.json` / `test/`)

Al escribir estos tests aparecieron dos gaps reales en el setup de Jest que no tenían que ver con
lógica de negocio, sino con que Jest no podía ni siquiera **cargar** ciertos módulos:

- **`.tsx` no reconocido**: `pdf.service.tsx`/`nutrition-plan.document.tsx` (`presentation/pdf/`)
  son `.tsx`, pero `moduleFileExtensions`/`transform` del jest config original solo cubrían
  `.ts`/`.js`. Se agregó `"tsx"` a `moduleFileExtensions` y se amplió el regex de `transform` a
  `^.+\.(t|j)sx?$` (en `package.json` y en `test/jest-e2e.json`).
- **`@react-pdf/renderer` es ESM puro**: el paquete (y varias de sus dependencias internas) solo se
  publica como ESM, que ts-jest no puede transformar tal cual — cualquier test que tocara
  (aunque sea transitivamente, vía DI) `EmailService`/`PlanGenerationService`/`WebhooksService`
  fallaba con `SyntaxError: Cannot use import statement outside a module`. Se agregó un
  `moduleNameMapper` (`^@react-pdf/renderer$` → `test/mocks/react-pdf-renderer.ts`) que reemplaza
  el paquete completo por componentes inertes + un `renderToBuffer` mockeado (`jest.fn()`
  resuelto a un `Buffer` vacío) — los tests nunca necesitan un PDF real, solo verificar que se
  invoque con los datos correctos.
- **`cron` deja un timer real vivo**: `RetentionService.onModuleInit()` (ver
  `presentation/orders/retention.service.ts`) programa un `CronJob` real (disparo diario 03:00).
  En el e2e, que levanta la app completa, esto dejaría un handle abierto que impide que Jest
  cierre el proceso limpio. Se agregó otro `moduleNameMapper` (`^cron$` →
  `test/mocks/cron.ts`) con un `CronJob` stub cuyo `start()`/`stop()` son no-ops. (El unit test de
  `RetentionService` resuelve el mismo problema con `jest.mock('cron', ...)` local, ver §4.)

Ambos stubs viven en `test/mocks/` y se referencian desde los dos jest config (`package.json` para
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
| `formulas/requirements.service.ts` | `requirements.service.spec.ts` | BMR Mifflin/Carrasco/FAO-OMS-UNU, ramas de `goal` (`definicion`/`volumen`/`mantencion`), athlete+somatotype, invariante calorías=macros |
| `formulas/supplements.service.ts` | `supplements.service.spec.ts` | las 4 prescripciones (creatina/cafeína/nitrato/bicarbonato), escalado por peso |
| `formulas/sport-session.service.ts` | `sport-session.service.spec.ts` | catálogo `SPORT_SESSIONS`, recomendación por código y fallback |
| `alimentos/meal-times.service.ts` | `meal-times.service.spec.ts` | completado de tiempos de comida (1→3+colación, 4+volumen, preservación de reportados) |
| `alimentos/portion-adequacy.service.ts` | `portion-adequacy.service.spec.ts` | `defineFoodGroups` (reglas de eliminación por tiempo de comida) + un escenario de `calculateFoodsAndIntake`/`calculateTotalPlanIntake`/`calculateTotalAdequacy` **trazado a mano y verificado contra el algoritmo real** (test de regresión "congelado": si el algoritmo cambia, este test detecta el cambio de números) |
| `alimentos/food-portions.ts` | `food-portions.spec.ts` | `findFoodGroup` (caso válido / lanza si no existe) |

### `presentation/` — pipeline `orders` → `webhooks` → `plan-generation`

| Servicio | Test | Mockea |
|---|---|---|
| `OrdersService` | `orders.service.spec.ts` | los 5 repositorios (`UserRepository`, `ClinicalRecordRepository`, `NutritionalConsultationRepository`, `ProductRepository`, `OrderRepository`) |
| `orders.mapper.ts` | `orders.mapper.spec.ts` | nada (funciones puras) |
| `OrdersController` | `orders.controller.spec.ts` | `OrdersService` |
| `RetentionService` | `retention.service.spec.ts` | `OrdersService` + `cron` (local `jest.mock`) |
| `WebhooksService` | `webhooks.service.spec.ts` | `OrdersService`, `PlanGenerationService` |
| `WebhooksController` | `webhooks.controller.spec.ts` | `WebhooksService` |
| `PlanGenerationService` | `plan-generation.service.spec.ts` | solo `OrdersService`/`OpenaiService`/`EmailService` — **las fórmulas de dominio corren de verdad** (test híbrido unit+integración); ver §5 |
| `ConsultationService` | `consultation.service.spec.ts` | `OpenaiService` |
| `ConsultationController` | `consultation.controller.spec.ts` | `ConsultationService` |
| `OpenaiService` | `openai.service.spec.ts` | el SDK `openai` (`jest.mock('openai', ...)`) |
| `EmailService` | `email.service.spec.ts` | `PdfService` |
| `HttpExceptionFilter` | `http-exception.filter.spec.ts` | `ArgumentsHost` construido a mano |

## 5. Patrones usados que vale la pena conocer antes de tocar estos tests

- **`PlanGenerationService` es un test híbrido**: solo se mockean los 3 bordes externos
  (`OrdersService`, `OpenaiService`, `EmailService`); `calculateRequirements`, `determineMealTimes`,
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
- **Fire-and-forget**: `WebhooksService.processPayment` dispara `generatePlan()` sin `await`; los
  tests que necesitan verificar ese llamado (o que un error ahí no rompe la respuesta HTTP) resuelven
  una promesa extra (`await new Promise((r) => setImmediate(r))`) para dejar correr el microtask
  antes de aserter.
- **`OpenaiService`** construye su propio cliente `OpenAI` en el constructor
  (`new OpenAI({apiKey:...})`); se mockea el paquete completo (`jest.mock('openai', () => ...)`)
  en vez de intentar inyectar el cliente, ya que no hay una forma de override por DI para él.

## 6. e2e (`test/app.e2e-spec.ts`)

Bootstrapea `AppModule` completo (routing, `ValidationPipe`, `HttpExceptionFilter` reales) contra
`supertest`, mockeando solo el mismo límite bajo que los unit tests: los 5 repositorios,
`OpenaiService`, `EmailService`, y además `PrismaService` (para que nadie intente conectarse a una
base de datos real al hacer `app.init()` — no se levanta Postgres en ningún momento). Cubre:

- `POST /ordenes/crear` — payload válido (201 + `orderId`), sin email (400), propiedad desconocida
  en el body (400, `forbidNonWhitelisted`).
- `GET /ordenes/obtener-estado/:id` — estado mockeado (200), id no-UUID (400), orden inexistente (404).
- `POST /webhooks/pago` — idempotencia (`procesado` → `ya_procesado`), `orden_id` no-UUID (400).

**Estado**: escrito y revisado, pero **no se pudo ejecutar en esta sesión** por falta de memoria
disponible en la máquina de desarrollo (levantar `AppModule` completo vía `ts-jest` compite con
Chrome/Discord/VS Code/Docker/WSL ya corriendo; el proceso de Jest fue matado 3 veces por el propio
harness al detectar memoria crítica). Correr `npm run test:e2e` con memoria disponible antes de
confiar en él como gate de CI.

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
- `test:e2e` sin verificar en CI (ver §6) — correrlo una vez con memoria disponible y confirmar que
  pasa antes de asumir que es un gate confiable.
- No hay tests de los servicios de `presentation/pdf` (`PdfService`) ni de los prompts de
  `plan-generation/prompts/**` (son generadores de texto para el prompt de la IA, sin lógica de
  negocio verificable más allá de "no revienta") — bajo valor, se dejaron fuera deliberadamente.
