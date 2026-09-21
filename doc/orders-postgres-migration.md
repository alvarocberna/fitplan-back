# Migración del flujo comercial a Postgres — `orders` → `webhooks` → `plan-generation`

Este documento describe cómo el flujo comercial (creación de orden → pago → generación del plan)
dejó de usar el modelo `Order` legacy (SQLite, tabla `orden`, con `payloadJson`/`planJson` como
strings JSON) y pasó a persistir de verdad sobre la capa de dominio Postgres que describe
**[doc/postgres-domain-groundwork.md](./postgres-domain-groundwork.md)**. Antes de esta migración,
esa capa era groundwork puro sin ningún consumidor real; este documento cubre exactamente el cambio
que la conectó por primera vez a un flujo de negocio real.

Si buscas cómo funciona hoy el producto de punta a punta, ver el README principal y
[flow-happy-path.md](./flow-happy-path.md) (ya actualizados para reflejar este cambio). Este
documento es la referencia detallada de la migración en sí — qué existía antes, qué se agregó y por
qué se tomó cada decisión de mapeo.

## 1. Estado previo a esta migración

`orders.service.ts` y `plan-generation.service.ts` seguían usando campos del `Order` legacy
(`email`, `payloadJson`, `paymentStatus`, `generationStatus`, `planJson`, `attempts`) que ya no
existen en el nuevo modelo `Order` (Postgres, dominio comercial) — el proyecto **no compilaba**.
Además, `PrismaService.onModuleInit()` ejecutaba `PRAGMA journal_mode=WAL;` (sintaxis específica de
SQLite), que habría roto el arranque contra Postgres. Ningún módulo de infraestructura del nuevo
dominio (`identity-auth`, `clinical-domain`, `commercial-domain`) estaba registrado en `AppModule`.

## 2. Cambios de `prisma/schema.prisma`

Migración `20260905203741_order_payment_status_and_consultation_link`
(`prisma/migrations/20260905203741_order_payment_status_and_consultation_link/migration.sql`).

**Modelo `Order`** (`commercial-domain`, tabla `order`): el campo `status` (`PENDING|PAID|EXPIRED|CANCELLED`)
se **renombró a `paymentStatus`** (`@map("payment_status")`) con nuevos valores
`'pendiente'|'pagado'` — coincidiendo exactamente con el `OrderStatusDto` legacy
(`src/domain/dtos/order.dto.ts`) que ya consumía el frontend y que no cambió. Se agregaron 3 columnas:

- `generationStatus String @default("no_iniciado") @map("generation_status")` — `no_iniciado|generando|completado|error`.
- `planJson String? @map("plan_json")` — el `NutritionPlanDto` serializado, igual que hacía el modelo legacy.
- `attempts Int @default(0)`.

Y la relación inversa `nutritionalConsultation NutritionalConsultation?`.

**Modelo `NutritionalConsultation`** (`clinical-domain`): se agregaron

- `orderId String? @unique @map("order_id") @db.Uuid` + `order Order? @relation(...)` — vínculo
  Order↔NutritionalConsultation, simétrico al patrón que ya existía en `NutritionalPlan.orderId`.
- `athlete Boolean?` — dato de `personalInfo.athlete` que no tenía hogar en ninguna entidad; se
  decidió que es un dato puntual de la consulta, no de la identidad del `User`.

**Nota operativa (histórica, no repetible)**: generar esta migración exigió resetear la base de
datos de desarrollo (`prisma migrate reset --force`, con `PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION`
y consentimiento explícito del usuario) por drift entre el historial de migraciones y la base real
(la tabla `orden` legacy ya se había eliminado manualmente).

## 3. Nuevos métodos en `domain/datasources` / `domain/repositories`

Mismo patrón que ya usaba el resto del groundwork: firma idéntica en el datasource y en el
repository correspondiente; el repository solo delega en el datasource
(`infrastructure/repositories/**/*.repository.ts` → `infrastructure/datasources/**/*.datasource.ts`).

- **`identity-auth/user`**: `findOrCreateUserByEmail(dto: FindOrCreateUserByEmailDto): Promise<UserEntity>`.
  Nuevo DTO en `src/domain/dtos/identity-auth/user/find-or-create-user-by-email.dto.ts`
  (`{email, rut, rutCheckDigit, firstName, middleName, paternalLastName, maternalLastName, gender, dateOfBirth}`).
  Busca por `email` (`@unique`); si no existe, crea. **No actualiza** un `User` existente con datos nuevos.
- **`clinical-domain/clinical-record`**: `findOrCreateClinicalRecordByPatientId(patientId: string): Promise<ClinicalRecordEntity>`.
  `patientId` es `@unique` en `ClinicalRecord` — un paciente tiene a lo más un `ClinicalRecord`.
- **`clinical-domain/nutritional-consultation`**:
  - `createNutritionalConsultationWithDetails(dto: CreateNutritionalConsultationDetailsDto): Promise<NutritionalConsultationEntity>`
    — crea el árbol completo `Anamnesis`+hijas y `Measurements`+hija en una sola operación atómica
    (nested create de Prisma).
  - `getNutritionalConsultationWithDetailsByOrderId(orderId): Promise<NutritionalConsultationEntity | null>`
    — misma forma, vía `include`; usado por `plan-generation`.
  - `countNutritionalConsultationsByClinicalRecordId(clinicalRecordId): Promise<number>` — para
    calcular `consultationNumber`.

  Nuevo DTO compuesto en
  `src/domain/dtos/clinical-domain/nutritional-consultation/create-nutritional-consultation-details.dto.ts`
  (`CreateNutritionalConsultationDetailsDto`, con sub-tipos `AnamnesisDetailsInput`/`MeasurementsDetailsInput`
  que componen los `Create*Dto` ya existentes de cada entidad hija, omitiendo la FK hacia su padre
  inmediato ya que Prisma la resuelve sola en el nested create).
- **`commercial-domain/product`**: `findOrCreateActiveGeneratedProduct(): Promise<ProductEntity>` —
  busca un `Product` `type='GENERATED' active=true`; si no existe, crea uno con valores
  **hardcodeados como placeholder** (ver [Deuda técnica](#6-deuda-técnica-de-esta-migración)).
- **`commercial-domain/order`**: `getOrderWithUserById(id)`,
  `markOrderAsPaidIfPending(id): Promise<boolean>` (idempotente, reemplaza el `updateMany` suelto
  que antes vivía en `orders.service.ts`), `tryTransitionOrderToGenerating(id): Promise<boolean>`
  (guard de estado `no_iniciado|error → generando`), `incrementOrderFailedAttempt(id): Promise<void>`,
  `anonymizeOldOrders(cutoffDate: Date): Promise<number>` (job de retención, ver §5).

La implementación concreta de `createNutritionalConsultationWithDetails`
(`src/infrastructure/datasources/clinical-domain/nutritional-consultation.datasource.ts`) usa una
constante de módulo `FULL_DETAILS_INCLUDE` (un `Prisma.NutritionalConsultationInclude` con
`anamneses.{goals, anamnesisClinical, anamnesisDietary.{dietaryRecalls24h.meals, foodPreferences.groups},
lifestyles.{sportsSessions, sportsStrategies}}` y `measurements.basicMeasurements`), reutilizada
también por `getNutritionalConsultationWithDetailsByOrderId`. **No incluye** `anamnesisPsychosocial`
ni `supplements` (la tabla `Supplements`, no confundir con los suplementos deportivos de
`PlanSupplement`) porque hoy no hay ningún dato fuente en `CompleteConsultationDto` para poblarlas.

`OrderEntity` (`src/domain/entities/order.entity.ts`) y `NutritionalConsultationEntity`
(`src/domain/entities/clinical-record.entity.ts`) se actualizaron con los campos nuevos descritos
arriba (`OrderStatus` ahora es `'pendiente'|'pagado'`, nuevo type `OrderGenerationStatus`).

## 4. Módulos de NestJS: primer consumidor real del groundwork

`src/presentation/orders/orders.module.ts` ahora importa `IdentityAuthRepositoriesModule`,
`ClinicalDomainRepositoriesModule` y `CommercialDomainRepositoriesModule` (Nest exige que el módulo
que inyecta un provider importe el módulo que lo exporta). `src/app.module.ts` ahora importa también
los 3 `*DatasourcesModule` correspondientes, además de los 3 `*RepositoriesModule`:

```ts
// app.module.ts — imports (orden real)
PrismaModule,
ConsultationModule,
OpenaiModule,
IdentityAuthDatasourcesModule,
IdentityAuthRepositoriesModule,
ClinicalDomainDatasourcesModule,
ClinicalDomainRepositoriesModule,
CommercialDomainDatasourcesModule,
CommercialDomainRepositoriesModule,
OrdersModule,
WebhooksModule,
```

**Esta es la primera vez que la capa de infraestructura del dominio Postgres tiene un consumidor
real** — antes de esta migración existía (incluida la capa `infrastructure/repositories/**`, que ya
delegaba 1:1 en `infrastructure/datasources/**` para las 33 entidades) pero no estaba registrada en
ningún módulo raíz. `WebhooksModule` y `PlanGenerationModule` no cambiaron: siguen dependiendo solo
de `OrdersService` como fachada, sin conocer Prisma ni los repositories directamente.

## 5. Reescritura de `src/presentation/orders/orders.service.ts`

El constructor pasó de recibir `PrismaService` a recibir 5 repositories: `UserRepository`,
`ClinicalRecordRepository`, `NutritionalConsultationRepository`, `ProductRepository`,
`OrderRepository`. **Ningún service de `presentation/` importa `PrismaService` ni tipos de Prisma
directamente ya** (antes `orders.service.ts` sí lo hacía).

`createOrder(dto: CompleteConsultationDtoImpl)` — el body de `POST /ordenes/crear`, que **no cambió
de forma** — hace, en orden:

1. Valida `personalInfo.email` (igual que antes).
2. `findOrCreateUserByEmail` con los datos de `personalInfo`.
3. `findOrCreateClinicalRecordByPatientId(user.id)`.
4. `findOrCreateActiveGeneratedProduct()`.
5. Crea la `Order` nueva: `paymentStatus:'pendiente', generationStatus:'no_iniciado', planJson:null,
   attempts:0, creationDate:new Date()`, `amount`/`currency` copiados del `Product`.
6. Calcula `consultationNumber` como `countNutritionalConsultationsByClinicalRecordId(clinicalRecord.id) + 1`.
7. Llama `createNutritionalConsultationWithDetails` con el árbol mapeado desde
   `dto.anamnesis`/`dto.measurements` (ver §7, `orders.mapper.ts`), incluyendo el `orderId` recién creado.
8. Retorna `{ orderId: order.id }` — **respuesta idéntica a la de antes**.

`getStatus`, `findById`, `markAsPaid`, `tryStartGeneration`, `completeGeneration`,
`recordFailedAttempt`, `cleanupOldOrders` se mantienen con el mismo nombre y comportamiento
observable, pero ahora delegan en `OrderRepository.*` en vez de `this.prisma.order.*`. Se eliminó
`getPayload()` (ya no existe `payloadJson`). Se agregaron dos métodos nuevos, usados solo por
`plan-generation`:

- `findByIdWithUser(id)` — trae la `Order` con el `User` incluido, para el email.
- `getConsultationForOrder(id)` — trae la `NutritionalConsultation` completa vía
  `getNutritionalConsultationWithDetailsByOrderId`, lanzando `NotFoundException` si no existe.
  **Esta es la nueva fuente de verdad que reemplaza al antiguo `payloadJson`.**

## 6. `src/presentation/orders/orders.mapper.ts` (archivo nuevo)

Traduce `CompleteConsultationDto` (el shape que llega por HTTP, que no cambió) hacia el input
compuesto que espera `createNutritionalConsultationWithDetails`. Decisiones de mapeo no obvias
(documentadas también con comentarios inline en el código — no "corregir" sin releer el comentario
primero):

- `mapMealDtoToEntity(meal)`: rename directo de la mayoría de campos; `Meal.highLipid` (DTO) →
  `DietaryRecall24hMealEntity.lipidRich`; `mealHour` (obligatorio en la entidad, sin fuente en el
  DTO) queda siempre `''`.
- `normalizeEventType(raw)`: `SportsSession.eventType` exige `'TRAINING'|'COMPETITION'|null`, pero el
  DTO solo trae texto libre — heurística por substring (`compet`→`COMPETITION`,
  `entrena`/`train`→`TRAINING`, cualquier otro texto→`null`).
- `mapAnamnesisDtoToDetails(anamnesis)`: los campos clínicos del DTO (`pathology`, `allergies`,
  `intolerances`, `medications`, `gastrointestinalHistory`, `surgeries`) son strings únicos, pero las
  columnas de `AnamnesisClinicalEntity` son arrays (`pathology: string[]`, etc.) — se envuelve el
  valor no-nulo en un array de 1 elemento (simplificación, no una lista real todavía).
  **Cruce de ramas importante**: `anamnesis.dietary.sportsStrategy` (así vive en el DTO, bajo
  `dietary`) se mapea hacia `Lifestyle.sportsStrategies` (la entidad la anida bajo `Lifestyle`, NO
  bajo `AnamnesisDietary`) — es intencional. `SportsStrategy.supplement`/`hydration` (arrays en el
  DTO) se unen con `', '` en un solo string (la entidad los tiene singulares).
- `mapMeasurementsDtoToDetails(measurements)`: `measurementNumber` fijo en `1` (este flujo siempre
  crea una sola tanda de measurements por consulta); `somatotype` (usado por `plan-generation`) **no
  tiene campo dedicado en el nuevo schema** — se persiste como texto libre en
  `Measurements.description`.

## 7. `src/presentation/plan-generation/plan-generation.service.ts`

Se reemplazó `const order = ordersService.findById(orderId); const payload =
ordersService.getPayload(order);` por `findByIdWithUser` + `getConsultationForOrder` + un nuevo
método privado `buildCompleteConsultationDto(order, consultation)` que **reconstruye la misma forma
`CompleteConsultationDto`** a partir de las entidades pobladas, en vez de adaptar todo el pipeline de
abajo (cálculo de requerimientos, prompts, validadores de porciones) al shape de las entidades — mucho
menos invasivo. Sub-helpers nuevos: `buildPersonalInfoDto(user, athlete)`,
`buildAnamnesisDto(anamnesis?)` (toma el índice `[0]` de cada relación 1-a-muchos, ya que este flujo
siempre crea exactamente una fila de cada una), `buildMeasurementsDto(measurements?)`. Al final del
flujo, el email para `EmailService.sendPlanByEmail` se obtiene de `order.user?.email` (antes
`order.email`, campo que ya no existe), con un guard explícito que lanza si falta.

**Importante**: el método privado ya existente `buildPersonalInfo` (arma `NutritionPlanDto.personalInfo`
a partir del `CompleteConsultationDto` reconstruido) **no se tocó ni se eliminó** — es una función
distinta de la nueva `buildPersonalInfoDto` (arma `PersonalInfoDto` a partir de `UserEntity`). No son
duplicadas pese al nombre parecido.

## 8. `src/infrastructure/orm/prisma/prisma.service.ts`

Se eliminó `await this.$queryRawUnsafe('PRAGMA journal_mode=WAL;')` (y el comentario asociado a
SQLite/modo WAL) de `onModuleInit` — ya no aplica, la base es Postgres.

## 9. Bug real encontrado y corregido durante la prueba end-to-end

`PersonalInfoDtoImpl.dateOfBirth` (`src/presentation/consultation/dto/consultation.dto.ts`) está
decorado con `@IsDateString()` pero **sin** `@Type(() => Date)`: `class-validator` valida el formato
pero no transforma el valor — en runtime sigue siendo un string (`"1990-05-15"`) pese a que el tipo
TypeScript declara `Date | null`. Al pasarlo directo a Prisma (columna `User.dateOfBirth @db.Date`),
Prisma lo rechazaba (`Invalid value for argument dateOfBirth: premature end of input. Expected
ISO-8601 DateTime`). Se corrigió en `orders.service.ts` convirtiendo explícitamente con
`new Date(personalInfo.dateOfBirth!)` antes de pasarlo a `findOrCreateUserByEmail`. **No se tocó el
DTO de consulta** (fuera de alcance de esta migración) — el mismo problema podría repetirse si en el
futuro se usa `personalInfo.dateOfBirth` en otro lugar esperando un objeto `Date` real.

## 10. Verificación end-to-end (real, hecha por el usuario)

Contra Postgres real (`localhost:5432`) y OpenAI real (modelo `gpt-5-mini`), con el servidor corriendo
(`npm run start:dev`):

- `POST /ordenes/crear` → `201` con el árbol completo persistido correctamente (verificado por SQL
  directo): `user`, `clinical_record`, `nutritional_consultation` con `order_id` vinculado, `goals`,
  `anamnesis_clinical` con arrays, `dietary_recall_24h_meal`, `food_preference_group`, `lifestyle`,
  `sports_session` con `event_type` normalizado a `TRAINING`, `sports_strategy` cross-mapeado desde
  `dietary.sportsStrategy`, `measurements`/`basic_measurements`.
- `GET /ordenes/obtener-estado/:id` con shape idéntico al legacy en cada etapa: `pendiente/no_iniciado`
  → `pagado/generando` → `pagado/completado`.
- `POST /webhooks/ordenes/:id/simular-pago` idempotente (`procesado` → `ya_procesado` en el segundo
  llamado).
- Generación real del plan completada en el primer intento (0 rechazos de validación de porciones,
  ~107s), con el `NutritionPlanDto` completo y correcto en `planJson`, reflejando datos reales de la
  anamnesis (por ejemplo, mencionó la intolerancia a la lactosa cargada en la consulta).
- Email "enviado" (stub) al `order.user.email` correcto.
- Se repitió el flujo con el mismo email: mismo `User`/`ClinicalRecord`/`Product` reusados
  (find-or-create funcionando), segunda `NutritionalConsultation` con `consultationNumber=2`.

## 11. Alcance de la conexión (qué sigue sin consumidor real)

Esta migración conecta **solo** lo que necesita el flujo comercial:

- `identity-auth`: `User` (vía `UserRepository.findOrCreateUserByEmail`). `AuthIdentity` sigue sin
  consumidor.
- `clinical-domain`: `ClinicalRecord`, `NutritionalConsultation`, `Anamnesis` y las hijas alcanzadas
  por `FULL_DETAILS_INCLUDE` (`Goals`, `AnamnesisClinical`, `AnamnesisDietary`, `DietaryRecall24h`,
  `DietaryRecall24hMeal`, `FoodPreference`, `FoodPreferenceGroup`, `Lifestyle`, `SportsSession`,
  `SportsStrategy`), `Measurements` y `BasicMeasurements`. El resto de `clinical-domain`
  (`AnamnesisPsychosocial`, `Supplements`, `Skinfolds`, `Circumferences`, `Diameters`,
  `MeasurementResults`, `NutritionalPlan` y sus hijas) sigue sin consumidor real **al cierre de esta
  migración** — migraciones posteriores le agregaron a `NutritionalPlan` (solo la fila principal, no
  las hijas) un consumidor de lectura (`presentation/panel/`, `GET /panel/resumen`, vía
  `getLatestNutritionalConsultationWithDetailsByPatientId`/`PANEL_DETAILS_INCLUDE`) y uno de escritura
  (`PlanGenerationService` → `NutritionalPlanRepository.upsertNutritionalPlanByOrderId`) — ver
  `doc/technical-debt.md`.
- `commercial-domain`: `Order`, `Product` (vía `findOrCreateActiveGeneratedProduct`). `Payment` sigue
  sin consumidor.

No generalizar diciendo que "todo" el dominio Postgres está conectado — ver
[postgres-domain-groundwork.md](./postgres-domain-groundwork.md) para el resto de la deuda de esa capa.

## 12. Deuda técnica de esta migración

Ver también [technical-debt.md](./technical-debt.md).

- Los valores default de `findOrCreateActiveGeneratedProduct()` (nombre, `price: 19990`,
  `currency: 'CLP'`) están **hardcodeados como placeholder** en
  `src/infrastructure/datasources/commercial-domain/product.datasource.ts` — no hay pricing real ni
  negociación comercial en el flujo actual (el pago se simula/confirma vía webhook sin gateway real).
  Revisar con negocio antes de producción.
- Mapeo lossy: campos clínicos singulares del DTO (`pathology`, `allergies`, etc.) se envuelven en
  arrays de 1 elemento al persistir — no es una lista real de múltiples valores todavía.
- `DietaryRecall24hMealEntity.mealHour` siempre se persiste como `''` (sin fuente en el DTO de consulta).
- `MeasurementsEntity` no tiene un campo dedicado para "somatotype"; se persiste como texto libre en
  `description`.
- `AnamnesisPsychosocialEntity` y `SupplementsEntity` (tabla de suplementos generales, distinta de
  `PlanSupplement`) nunca se pueblan — no hay datos fuente en `CompleteConsultationDto` hoy.
- `personalInfo.dateOfBirth` no se transforma a `Date` en el DTO de consulta (`@IsDateString()` sin
  `@Type(() => Date)`) — cualquier otro consumidor futuro de ese campo debe convertirlo
  explícitamente, como se hizo en `orders.service.ts` (ver §9).
- El job de retención de 45 días (`RetentionService`, que anonimizaba `Order.planJson`) se eliminó:
  los datos de salud se conservan sin límite. Si se vuelve a necesitar una política de
  retención/anonimización, debe cubrir `NutritionalConsultation`/`Anamnesis`/`Measurements` y
  `NutritionalPlan`.
