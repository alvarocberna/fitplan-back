# Nuevo dominio (Postgres) — groundwork, hoy ya conectado al flujo comercial

Este documento describe la capa de arquitectura nueva que se construyó originalmente **en paralelo**
al flujo legacy (consulta → orden → pago → generación de plan, que corría sobre SQLite y un modelo
`Order` que ya no existe en `schema.prisma`). Define el modelo de dominio completo del producto
(identidad/auth, historial clínico, comercial) sobre un `schema.prisma` de Postgres, con sus
entidades, DTOs, contratos, datasources y repositories.

> **Actualización — esta capa ya no es groundwork "sin consumidor" en su totalidad.** Una migración
> posterior conectó de verdad `identity-auth` (`User`), `clinical-domain` (`ClinicalRecord`,
> `NutritionalConsultation`, `Anamnesis` y sus hijas básicas, `Measurements`/`BasicMeasurements`) y
> `commercial-domain` (`Order`, `Product`) al flujo real `orders` → `webhooks` → `plan-generation`,
> reemplazando por completo el mecanismo legacy de `payloadJson`/`planJson` sobre el `Order` de
> SQLite. Ver el detalle completo de esa migración en
> **[doc/orders-postgres-migration.md](./orders-postgres-migration.md)**. El resto de este documento
> sigue describiendo con precisión la arquitectura general de la capa (entidades, DTOs, datasources,
> repositories) tal como se construyó; **no generalizar** — partes de ella (`AuthIdentity`, `Payment`,
> la mayoría de `clinical-domain` fuera de `Anamnesis`/`Measurements` básicos) siguen sin ningún
> consumidor real, ver §7 y §9 más abajo. `NutritionalPlan` (solo la fila principal; sus hijas siguen
> sin poblarse) es un caso aparte: tiene un consumidor de **escritura** (`PlanGenerationService` →
> `PlanRepository.upsertPlanWithMainNutritionalPlanByOrderId`, vía el `Plan` de la orden) y uno de **lectura** desde
> `presentation/panel/` (`GET /panel/resumen`, vía
> `NutritionalConsultationRepository.getLatestNutritionalConsultationWithDetailsByPatientId`) — ver
> `doc/technical-debt.md`.

Si estás buscando cómo funciona el producto en producción hoy, ver el README principal y
`doc/flow-happy-path.md`. Este documento sigue siendo la única fuente de verdad sobre las decisiones
de diseño tomadas durante la construcción original de esta capa, ya que no hay PR/commit description
que las capture.

## 1. El nuevo schema (`prisma/schema.prisma`)

`prisma/schema.prisma` pasó de SQLite a **Postgres** (`datasource db { provider = "postgresql" }`).
El modelo `Order` legacy (tabla `orden`) quedó **comentado** en el mismo archivo, justo antes de las
secciones nuevas — no se borró, para no perder la referencia mientras convive con el reemplazo. Todo
lo demás en el archivo es nuevo y se organiza en tres secciones comentadas, cada una correspondiente
a una carpeta homónima en `domain/dtos`, `domain/datasources`, `domain/repositories` e
`infrastructure/datasources`:

| Sección del schema | Modelos Prisma | Carpeta de dominio |
|---|---|---|
| `IDENTITY & AUTH` | `User`, `AuthIdentity` | `identity-auth/` |
| `CLINICAL DOMAIN` | `ClinicalRecord`, `NutritionalConsultation`, `Anamnesis` y sus 11 hijas (`Goals`, `AnamnesisClinical`, `ClinicalCondition`, `AnamnesisDietary`, `DietaryRecall24h`, `DietaryRecall24hMeal`, `FoodPreference`, `FoodPreferenceGroup`, `Supplements`, `AnamnesisPsychosocial`, `Lifestyle`, `SportsSession`, `SportsStrategy`), `Measurements` y sus 5 hijas (`BasicMeasurements`, `Skinfolds`, `Circumferences`, `Diameters`, `MeasurementResults`), `NutritionalPlan` y sus 5 hijas (`PlanMealTime`, `PlanMealTimeNote`, `PlanSupplement`, `PlanSupplementNote`, `PlanSportsRecommendation`) | `clinical-domain/` |
| `COMMERCIAL DOMAIN` | `Product`, `Order`, `Payment` | `commercial-domain/` |

Total: **35 modelos/entidades** (2 identity-auth + 30 clinical-domain + 3 commercial-domain; `Plan` y
`Projection` se agregaron en la migración `20260925120000_plan_entity`; desde `20260926120000_erd_sync`
`Projection` cuelga de `Plan` —un `Plan` puede tener varias— y ya no de `Measurements`).

Nota de nombres: el nuevo modelo `Order` (Postgres, tabla `order`) se llamaba `CommercialOrder` en
un momento para no chocar con el `Order` legacy (tabla `orden`, SQLite); una vez que el legacy quedó
comentado, se renombró a `Order` a secas. **No confundir ambos**: son modelos completamente
distintos con el mismo nombre — `domain/entities/order.entity.ts` (nuevo, usuario + producto + pago)
no tiene relación con `domain/dtos/order.dto.ts` (legacy, describe la tabla `orden`).

Los campos de valores cerrados (`AuthIdentity.provider`, `Order.paymentStatus`/`generationStatus`,
`Payment.provider`/`status`, `Product.type`, `SportsSession.eventType`, `Measurements.level`,
`NutritionalPlan.period`, `PlanMealTime.time`, `PlanMealTimeNote.type`, `PlanSupplementNote.type`)
son **enums nativos de Postgres** (bloques `enum` en `schema.prisma`, migración
`20260926120000_erd_sync`). En el dominio se reflejan en `domain/entities/enums.ts` como objeto
`as const` + tipo unión (la misma forma que genera Prisma), así que los valores son intercambiables
sin casts y el dominio no depende del cliente generado.

## 2. `src/domain/entities/` — entidades de dominio

Un archivo `.entity.ts` por **sección** del schema (no uno por modelo): `user.entity.ts`,
`clinical-record.entity.ts` (incluye `ClinicalRecordEntity` y `NutritionalConsultationEntity`),
`anamnesis.entity.ts`, `measurements.entity.ts`, `nutritional-plan.entity.ts`, `product.entity.ts`,
`order.entity.ts`, `payment.entity.ts`. Cada archivo exporta interfaces TypeScript planas — sin
decoradores, sin dependencias de Prisma ni de NestJS — que mapean 1:1 los modelos Prisma de esa
sección, con el sufijo `Entity` (`AnamnesisEntity`, `UserEntity`, etc.). En total, 33 entidades.

Decisiones de tipado, consistentes en las 33:

- **Campos de relación son opcionales (`?`)**: solo vienen poblados si la query a Prisma usa
  `include`; su ausencia no es un error de dominio.
- **Enums declarados como `String` en el schema se tipan como unión de literales** en la entidad de
  dominio (ej. `anamnesis.entity.ts` exporta `export type SportsEventType = 'TRAINING' |
  'COMPETITION';`; también existen `AuthProvider`, `OrderStatus`, `ProductType`,
  `PlanMealTimeSlot`, `PlanMealTimeNoteType`, `PlanSupplementNoteType`, `PaymentProvider`,
  `PaymentTransactionStatus`) — el dominio queda más estricto que la columna real, a costa de un
  cast en el punto donde se lee de Prisma (ver §6).
- **`Decimal` de Prisma se tipa como `number`** en la entidad de dominio (`OrderEntity.amount`,
  `PaymentEntity.amount`, `ProductEntity.price`): el dominio no debe conocer el tipo `Decimal` de
  Prisma. La conversión real (`.toNumber()`) ocurre en infraestructura, no en la entidad.
- **Referencias cruzadas entre archivos de entidades usan `import type`**, para evitar problemas de
  import circular en runtime (se eliminan en compilación).

## 3. `src/domain/dtos/{identity-auth,clinical-domain,commercial-domain}/`

Se agregaron tres carpetas nuevas dentro de `domain/dtos/`, reflejando las tres secciones del
schema. Dentro de cada una, una subcarpeta por entidad (ej. `clinical-domain/anamnesis/`,
`clinical-domain/goals/`, `commercial-domain/order/`), y dentro de cada subcarpeta dos archivos:
`create-<entidad>.dto.ts` y `update-<entidad>.dto.ts`.

Patrón, siempre el mismo:

```ts
// create-order.dto.ts
export type CreateOrderDto = Omit<
  OrderEntity,
  'id' | 'user' | 'product' | 'payments' | 'nutritionalPlan'
>;

// update-order.dto.ts
export type UpdateOrderDto = Partial<CreateOrderDto>;
```

`Create<Entidad>Dto` es la entidad completa menos `id`, los campos de relación, y (cuando el modelo
los tiene con `@default(now())`/`@updatedAt`) `createdAt`/`updatedAt`, que Prisma genera solos.
`Update<Entidad>Dto` es ese mismo tipo con todos los campos opcionales.

**Importante — no confundir con los DTOs de `presentation/**/dto`** que describe `CLAUDE.md` (clases
decoradas con `class-validator` para request/response HTTP). Estos `Create*Dto`/`Update*Dto` son
tipos planos de TypeScript, sin validación de runtime, usados solo como firma de los métodos de los
datasources/repositories de dominio (ver §4).

Estos DTOs conviven con los DTOs legacy que ya existían sueltos en `domain/dtos/*.dto.ts` (fuera de
las tres carpetas nuevas — `anamnesis-chat.dto.ts`, `consultation.dto.ts`, `nutrition-plan.dto.ts`,
`order.dto.ts`), que pertenecen al flujo SQLite y no se tocaron.

### Barrel (`src/domain/index.ts`)

Ya existía un barrel con los exports del flujo legacy (`dtos/*.dto`, varios `services/formulas/*`,
`services/objects/*`). Se amplió al final del archivo con un export por cada `create-*.dto.ts` /
`update-*.dto.ts` nuevo, en tres bloques comentados (`// identity-auth`, `// clinical-domain`, `//
commercial-domain`). Los datasources de dominio importan sus DTOs desde este barrel (`from '../..'`
o `from '..'` según la profundidad de su carpeta), no desde el archivo del DTO directamente — así se
evita el ida-y-vuelta de imports relativos largos entre `datasources/` y `dtos/`.

## 4. `src/domain/datasources/` — contratos (clases abstractas)

Mismas tres carpetas de dominio (`identity-auth/`, `clinical-domain/`, `commercial-domain/`, sin
subcarpeta por entidad aquí a diferencia de `dtos/`). Un archivo `<entidad>.datasource.ts` por cada
una de las 33 entidades, exportando una clase abstracta `<Entidad>Datasource` con 4 métodos CRUD:

```ts
export abstract class UserDatasource {
  abstract createUser(createUserDto: CreateUserDto): Promise<UserEntity>;
  abstract getUserById(id: string): Promise<UserEntity | null>;
  abstract updateUserById(id: string, updateUserDto: UpdateUserDto): Promise<UserEntity>;
  abstract deleteUserById(id: string): Promise<void>;
}
```

Los métodos usan siempre el nombre de la entidad en el nombre del método (`createAnamnesis`,
`getAnamnesisById`, `updateAnamnesisById`, `deleteAnamnesisById`), no un CRUD genérico — así cada
datasource es autoexplicativo al importarlo suelto.

## 5. `src/domain/repositories/` — mismo contenido, clase renombrada

Mismas tres carpetas y mismos 33 archivos que `domain/datasources/` (`<entidad>.repository.ts`),
**contenido idéntico** salvo el nombre de la clase abstracta: `<Entidad>Datasource` →
`<Entidad>Repository` (ej. `AnamnesisRepository`, con los mismos 4 métodos que `AnamnesisDatasource`
pero sin ninguna diferencia funcional).

Es deuda técnica intencional (ver `doc/technical-debt.md`): no hay hoy una decisión de arquitectura
sobre cómo deben diferenciarse `datasources` y `repositories` — por ejemplo, si `repository`
terminará orquestando/componiendo múltiples `datasources`, o si uno de los dos conjuntos se
eliminará una vez que se decida. Se dejaron ambos a pedido explícito del responsable del proyecto.

## 6. `src/infrastructure/datasources/` — implementaciones con Prisma

Mismas tres carpetas de dominio. Por cada uno de los 33 `domain/datasources/**/<entidad>.datasource.ts`
existe un archivo de infraestructura con el mismo nombre y ruta relativa
(`infrastructure/datasources/<dominio>/<entidad>.datasource.ts`), que exporta una clase
`<Entidad>DatasourceImpl` (convención `*Impl` ya usada en `presentation/**/dto`, ver `CLAUDE.md`),
marcada `@Injectable()`, que implementa la clase abstracta de dominio inyectando `PrismaService`
(`src/infrastructure/orm/prisma/prisma.service.ts`) por constructor y llamando directamente al
modelo Prisma correspondiente (`this.prisma.<modelo>.create/findUnique/update/delete`).

Se crearon los 33 (no solo los de entidades "padre"), a pedido explícito del responsable del
proyecto, con el plan de podar más adelante las que no se terminen usando de forma independiente —
en particular las entidades "hijas" que en la práctica probablemente se creen/actualicen/eliminen
siempre a través de su padre vía `include` de Prisma, no con su propio datasource (ver
`doc/technical-debt.md`).

### Conversión Prisma → Entity

En 25 de los 33 archivos, el resultado de Prisma es estructuralmente idéntico a la entidad de
dominio y se retorna tal cual. En los otros 8 hace falta un método privado `toEntity()` que mapea
explícitamente, porque Prisma devuelve un tipo más amplio que el dominio:

- ~~Campos "enum-as-string"~~: desde que son enums nativos (ver §1) ya no requieren cast; los
  `toEntity()` que solo existían para eso se eliminaron.
- **Campos `Decimal`**: `OrderDatasourceImpl.amount`, `PaymentDatasourceImpl.amount`,
  `ProductDatasourceImpl.price` — Prisma los devuelve como instancia de la clase `Decimal`
  (decimal.js-like), **no** como `number` de JS. Esto era un bug real de tipos, no solo cosmético
  (en runtime el valor no era un `number` primitivo pese a que el tipo de la entidad lo declaraba
  así), corregido con `.toNumber()` dentro del mismo `toEntity()`:

  ```ts
  private toEntity(order: PrismaOrder): OrderEntity {
    return {
      ...order,
      amount: order.amount.toNumber(),
      status: order.status as OrderStatus,
    };
  }
  ```

## 7. Módulos de NestJS: abstracción → implementación

Un archivo `.module.ts` por carpeta de dominio (no uno por entidad):

- `src/infrastructure/datasources/identity-auth/identity-auth-datasources.module.ts` →
  `IdentityAuthDatasourcesModule`
- `src/infrastructure/datasources/clinical-domain/clinical-domain-datasources.module.ts` →
  `ClinicalDomainDatasourcesModule`
- `src/infrastructure/datasources/commercial-domain/commercial-domain-datasources.module.ts` →
  `CommercialDomainDatasourcesModule`

Cada uno registra, para cada entidad de su dominio, un *custom provider* que ata la clase abstracta
de `domain/datasources` a su `*Impl` de infraestructura:

```ts
{ provide: OrderDatasource, useClass: OrderDatasourceImpl }
```

y **exporta la clase abstracta, nunca el `*Impl`**, de forma que cualquier consumidor futuro inyecte
`OrderDatasource` (el contrato de dominio) sin conocer que por debajo hay Prisma — preservando la
inversión de dependencias. Ninguno de los tres módulos importa `PrismaModule` explícitamente,
porque es `@Global()` (ya disponible en todo el árbol una vez que `AppModule` lo carga).

> **Actualización**: los tres módulos de `identity-auth`, `clinical-domain` y `commercial-domain`
> **sí están registrados en `AppModule`** desde la migración descrita en
> [orders-postgres-migration.md](./orders-postgres-migration.md) — `src/app.module.ts` importa los 3
> `*DatasourcesModule` junto con los 3 `*RepositoriesModule` correspondientes (ver más abajo), y
> `OrdersModule` los usa para construir `OrdersService`. Lo que describe el párrafo original de esta
> sección (que sigue siendo cierto para el resto del párrafo) es que **antes** de esa migración
> ninguno estaba registrado; se deja el texto original a continuación como referencia histórica de
> cómo se construyó el módulo, más una capa que faltaba documentar aquí:
>
> Además de `infrastructure/datasources/**` (arriba), ya existía —sin documentar en este archivo—
> una capa `infrastructure/repositories/**`: un archivo `<entidad>.repository.ts` por entidad,
> exportando `<Entidad>RepositoryImpl`, que implementa la clase abstracta de `domain/repositories`
> inyectando por constructor la clase abstracta de `domain/datasources` (no `PrismaService`
> directamente) y delegando cada método 1:1 (`return this.datasource.<metodo>(...)`). Cada
> `<dominio>-repositories.module.ts` (ej. `CommercialDomainRepositoriesModule`) importa el
> `*DatasourcesModule` de su mismo dominio, ata `{ provide: <Entidad>Repository, useClass:
> <Entidad>RepositoryImpl }` y exporta solo la clase abstracta — mismo patrón de inversión de
> dependencias que la capa de datasources. Un consumidor (ej. `OrdersService`) importa el
> `*RepositoriesModule` e inyecta `UserRepository`/`OrderRepository`/etc., sin conocer que por debajo
> hay un datasource que a su vez usa Prisma.

Antes de la migración descrita arriba, **ninguno de estos tres módulos estaba registrado en
`AppModule`** (`src/app.module.ts` solo importaba `ConfigModule`, `PrismaModule`,
`ConsultationModule`, `OpenaiModule`, `OrdersModule`, `WebhooksModule`) — era intencional: no había
todavía ningún caso de uso real que los necesitara. Quedaban listos para cuando se conectara un
consumidor real o se hiciera la poda mencionada en §6; eso es lo que ocurrió después.

## 8. Árbol de directorios resultante (resumen)

```
src/
├── domain/
│   ├── entities/                         # 8 archivos, 33 interfaces *Entity
│   │   ├── user.entity.ts
│   │   ├── clinical-record.entity.ts
│   │   ├── anamnesis.entity.ts
│   │   ├── measurements.entity.ts
│   │   ├── nutritional-plan.entity.ts
│   │   ├── product.entity.ts
│   │   ├── order.entity.ts
│   │   └── payment.entity.ts
│   ├── dtos/
│   │   ├── *.dto.ts                       # legacy (flujo SQLite, sin tocar)
│   │   ├── identity-auth/<entidad>/{create,update}-<entidad>.dto.ts
│   │   ├── clinical-domain/<entidad>/{create,update}-<entidad>.dto.ts
│   │   └── commercial-domain/<entidad>/{create,update}-<entidad>.dto.ts
│   ├── datasources/
│   │   ├── identity-auth/<entidad>.datasource.ts
│   │   ├── clinical-domain/<entidad>.datasource.ts
│   │   └── commercial-domain/<entidad>.datasource.ts
│   ├── repositories/                      # duplicado de datasources/ (ver §5)
│   │   ├── identity-auth/<entidad>.repository.ts
│   │   ├── clinical-domain/<entidad>.repository.ts
│   │   └── commercial-domain/<entidad>.repository.ts
│   └── index.ts                           # barrel legacy + nuevo (§3)
│
└── infrastructure/
    ├── orm/prisma/                        # sin cambios
    └── datasources/
        ├── identity-auth/
        │   ├── <entidad>.datasource.ts (*Impl)
        │   └── identity-auth-datasources.module.ts
        ├── clinical-domain/
        │   ├── <entidad>.datasource.ts (*Impl)
        │   └── clinical-domain-datasources.module.ts
        └── commercial-domain/
            ├── <entidad>.datasource.ts (*Impl)
            └── commercial-domain-datasources.module.ts
```

## 9. Convivencia con el flujo legacy (estado histórico — ver actualización arriba)

Lo que sigue describe la situación **tal como estaba antes** de la migración de
[orders-postgres-migration.md](./orders-postgres-migration.md); se deja como referencia histórica de
cómo convivían ambos modelos mientras el `Order` nuevo no tenía consumidor:

- El modelo `Order` legacy (SQLite, tabla `orden`, con `payloadJson`/`planJson` como strings JSON) ya
  no existe en `prisma/schema.prisma` — está comentado, reemplazado por el `Order` nuevo descrito en
  este documento. `OrdersService` / `WebhooksService` / `PlanGenerationService` **ya no leen ni
  escriben ningún modelo legacy**: usan el `Order` de `commercial-domain` y el árbol
  `ClinicalRecord`/`NutritionalConsultation`/`Anamnesis`/`Measurements` de `clinical-domain` a través
  de los repositories descritos en §4/§5, tal como documenta
  [orders-postgres-migration.md](./orders-postgres-migration.md).
- El `Order` nuevo (Postgres, `commercial-domain`) y el `Order` legacy (que existió en algún momento
  sobre SQLite, tabla `orden`) fueron siempre modelos distintos, sin relación entre sí en el schema ni
  en el código, más allá de compartir nombre de modelo Prisma.
- El contrato HTTP observable (`POST /consulta/chat`, `POST /ordenes/crear`, los webhooks de pago, la
  generación de plan en background) **no cambió de forma** con esta migración — mismos endpoints,
  mismos requests/responses — solo cambió la persistencia por debajo. Ver el README y
  `doc/flow-happy-path.md`, ya actualizados.

Ver `doc/technical-debt.md` y [orders-postgres-migration.md § Deuda técnica](./orders-postgres-migration.md#12-deuda-técnica-de-esta-migración)
para el detalle de los puntos pendientes de esta capa.
