-- Sincroniza el schema con doc/database/entity-relation-diagram.md. Escrita a mano: Prisma generaría
-- DROP + ADD para los renombres y para las columnas que pasan a enum, perdiendo datos.
--   * enums nativos para columnas con valores cerrados (estados de order en inglés)
--   * athlete pasa de nutritional_consultation a user
--   * dietary_recall_24h_meal.carbohydrate -> cereals, y sus campos pasan a nullable
--   * measurement_results.mmi -> lbmi
--   * projection cuelga de plan (antes de measurements)
--   * updated_at nullable; nutritional_plan.plan_name/start_date/goal/diet_regimen NOT NULL

-- =========================================
-- Enums
-- =========================================
CREATE TYPE "public"."AuthProvider" AS ENUM ('COGNITO', 'GOOGLE');
CREATE TYPE "public"."SportsEventType" AS ENUM ('TRAINING', 'COMPETITION');
CREATE TYPE "public"."MeasurementLevel" AS ENUM ('BASIC', 'ISAK 1', 'BIOIMPEDANCE');
CREATE TYPE "public"."PlanPeriod" AS ENUM ('EVENTO', 'MICROCICLO', 'MESOCICLO', 'MACROCICLO');
CREATE TYPE "public"."PlanMealTimeSlot" AS ENUM ('BREAKFAST', 'LUNCH', 'AFTERNOON_TEA', 'DINNER', 'SNACK');
CREATE TYPE "public"."PlanMealTimeNoteType" AS ENUM ('EXAMPLE', 'COMMENT');
CREATE TYPE "public"."PlanSupplementNoteType" AS ENUM ('EFFECT', 'CONSIDERATION');
CREATE TYPE "public"."ProductType" AS ENUM ('PREDEFINED', 'GENERATED');
CREATE TYPE "public"."PaymentStatus" AS ENUM ('PENDING', 'PAID');
CREATE TYPE "public"."GenerationStatus" AS ENUM ('NOT_STARTED', 'GENERATING', 'COMPLETED', 'ERROR');
CREATE TYPE "public"."PaymentProvider" AS ENUM ('TRANSBANK', 'SIMULATED');
CREATE TYPE "public"."PaymentTransactionStatus" AS ENUM ('AUTHORIZED', 'REJECTED', 'CANCELLED');

-- order: los estados se traducen al inglés antes del cast.
ALTER TABLE "public"."order" ALTER COLUMN "payment_status" DROP DEFAULT;
ALTER TABLE "public"."order" ALTER COLUMN "generation_status" DROP DEFAULT;

UPDATE "public"."order" SET "payment_status" = CASE "payment_status"
  WHEN 'pendiente' THEN 'PENDING'
  WHEN 'pagado' THEN 'PAID'
  ELSE "payment_status" END;

UPDATE "public"."order" SET "generation_status" = CASE "generation_status"
  WHEN 'no_iniciado' THEN 'NOT_STARTED'
  WHEN 'generando' THEN 'GENERATING'
  WHEN 'completado' THEN 'COMPLETED'
  WHEN 'error' THEN 'ERROR'
  ELSE "generation_status" END;

ALTER TABLE "public"."order"
  ALTER COLUMN "payment_status" TYPE "public"."PaymentStatus" USING "payment_status"::"public"."PaymentStatus",
  ALTER COLUMN "generation_status" TYPE "public"."GenerationStatus" USING "generation_status"::"public"."GenerationStatus";

ALTER TABLE "public"."order" ALTER COLUMN "payment_status" SET DEFAULT 'PENDING';
ALTER TABLE "public"."order" ALTER COLUMN "generation_status" SET DEFAULT 'NOT_STARTED';

ALTER TABLE "public"."payment"
  ALTER COLUMN "provider" TYPE "public"."PaymentProvider" USING "provider"::"public"."PaymentProvider",
  ALTER COLUMN "status" TYPE "public"."PaymentTransactionStatus" USING "status"::"public"."PaymentTransactionStatus";

ALTER TABLE "public"."product"
  ALTER COLUMN "type" TYPE "public"."ProductType" USING "type"::"public"."ProductType";

ALTER TABLE "public"."auth_identity"
  ALTER COLUMN "provider" TYPE "public"."AuthProvider" USING "provider"::"public"."AuthProvider";

ALTER TABLE "public"."sports_session"
  ALTER COLUMN "event_type" TYPE "public"."SportsEventType" USING "event_type"::"public"."SportsEventType";

ALTER TABLE "public"."measurements"
  ALTER COLUMN "level" TYPE "public"."MeasurementLevel" USING "level"::"public"."MeasurementLevel";

ALTER TABLE "public"."nutritional_plan"
  ALTER COLUMN "period" TYPE "public"."PlanPeriod" USING "period"::"public"."PlanPeriod";

ALTER TABLE "public"."plan_meal_time"
  ALTER COLUMN "time" TYPE "public"."PlanMealTimeSlot" USING "time"::"public"."PlanMealTimeSlot";

ALTER TABLE "public"."plan_meal_time_note"
  ALTER COLUMN "type" TYPE "public"."PlanMealTimeNoteType" USING "type"::"public"."PlanMealTimeNoteType";

ALTER TABLE "public"."plan_supplement_note"
  ALTER COLUMN "type" TYPE "public"."PlanSupplementNoteType" USING "type"::"public"."PlanSupplementNoteType";

-- =========================================
-- athlete: nutritional_consultation -> user
-- =========================================
ALTER TABLE "public"."user" ADD COLUMN "athlete" BOOLEAN NOT NULL DEFAULT false;

-- Se toma el valor de la consulta más reciente de cada usuario.
UPDATE "public"."user" u
SET "athlete" = latest."athlete"
FROM (
  SELECT DISTINCT ON ("patient_id") "patient_id", "athlete"
  FROM "public"."nutritional_consultation"
  WHERE "athlete" IS NOT NULL
  ORDER BY "patient_id", "consultation_date" DESC
) latest
WHERE latest."patient_id" = u."id";

ALTER TABLE "public"."nutritional_consultation" DROP COLUMN "athlete";

-- =========================================
-- updated_at nullable
-- =========================================
ALTER TABLE "public"."user" ALTER COLUMN "updated_at" DROP NOT NULL;
ALTER TABLE "public"."clinical_record" ALTER COLUMN "updated_at" DROP NOT NULL;
ALTER TABLE "public"."nutritional_consultation" ALTER COLUMN "updated_at" DROP NOT NULL;
ALTER TABLE "public"."product" ALTER COLUMN "updated_at" DROP NOT NULL;

-- =========================================
-- dietary_recall_24h_meal
-- =========================================
ALTER TABLE "public"."dietary_recall_24h_meal" RENAME COLUMN "carbohydrate" TO "cereals";

ALTER TABLE "public"."dietary_recall_24h_meal" ALTER COLUMN "description" DROP DEFAULT;

ALTER TABLE "public"."dietary_recall_24h_meal"
  ALTER COLUMN "meal_hour" DROP NOT NULL,
  ALTER COLUMN "description" DROP NOT NULL,
  ALTER COLUMN "cereals" DROP NOT NULL,
  ALTER COLUMN "free_consumption_vegetable" DROP NOT NULL,
  ALTER COLUMN "general_consumption_vegetable" DROP NOT NULL,
  ALTER COLUMN "fruit" DROP NOT NULL,
  ALTER COLUMN "high_fat_protein" DROP NOT NULL,
  ALTER COLUMN "low_fat_protein" DROP NOT NULL,
  ALTER COLUMN "high_fat_dairy" DROP NOT NULL,
  ALTER COLUMN "medium_fat_dairy" DROP NOT NULL,
  ALTER COLUMN "low_fat_dairy" DROP NOT NULL,
  ALTER COLUMN "high_protein_dairy" DROP NOT NULL,
  ALTER COLUMN "lipid_rich" DROP NOT NULL,
  ALTER COLUMN "oil" DROP NOT NULL,
  ALTER COLUMN "sugar" DROP NOT NULL,
  ALTER COLUMN "alcohol" DROP NOT NULL;

-- Antes se guardaba '' cuando el dato no venía; ahora se representa con NULL.
UPDATE "public"."dietary_recall_24h_meal" SET
  "meal_hour" = NULLIF("meal_hour", ''),
  "description" = NULLIF("description", ''),
  "cereals" = NULLIF("cereals", ''),
  "free_consumption_vegetable" = NULLIF("free_consumption_vegetable", ''),
  "general_consumption_vegetable" = NULLIF("general_consumption_vegetable", ''),
  "fruit" = NULLIF("fruit", ''),
  "high_fat_protein" = NULLIF("high_fat_protein", ''),
  "low_fat_protein" = NULLIF("low_fat_protein", ''),
  "high_fat_dairy" = NULLIF("high_fat_dairy", ''),
  "medium_fat_dairy" = NULLIF("medium_fat_dairy", ''),
  "low_fat_dairy" = NULLIF("low_fat_dairy", ''),
  "high_protein_dairy" = NULLIF("high_protein_dairy", ''),
  "lipid_rich" = NULLIF("lipid_rich", ''),
  "oil" = NULLIF("oil", ''),
  "sugar" = NULLIF("sugar", ''),
  "alcohol" = NULLIF("alcohol", '');

-- =========================================
-- measurement_results: mmi -> lbmi
-- =========================================
ALTER TABLE "public"."measurement_results" RENAME COLUMN "mmi" TO "lbmi";
ALTER TABLE "public"."measurement_results" RENAME COLUMN "mmi_classification" TO "lbmi_classification";

-- =========================================
-- projection: measurements -> plan (tabla sin uso, se vacía)
-- =========================================
DELETE FROM "public"."projection";

ALTER TABLE "public"."projection" DROP CONSTRAINT "projection_measurements_id_fkey";
ALTER TABLE "public"."projection" DROP COLUMN "measurements_id";
ALTER TABLE "public"."projection" RENAME COLUMN "projected_date" TO "projected_start_date";

ALTER TABLE "public"."projection"
  ADD COLUMN "plan_id" UUID NOT NULL,
  ADD COLUMN "projected_end_date" DATE NOT NULL,
  ALTER COLUMN "projected_start_date" SET NOT NULL,
  ALTER COLUMN "projected_weight" SET NOT NULL;

ALTER TABLE "public"."projection" ADD CONSTRAINT "projection_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "public"."plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- =========================================
-- nutritional_plan: plan_name/start_date/goal/diet_regimen NOT NULL
-- =========================================
-- Backfill de filas antiguas: nombre del producto y fecha de creación de la orden del plan.
UPDATE "public"."nutritional_plan" np
SET
  "plan_name" = COALESCE(np."plan_name", pr."name"),
  "start_date" = COALESCE(np."start_date", o."creation_date"::date)
FROM "public"."plan" p
JOIN "public"."order" o ON o."id" = p."order_id"
JOIN "public"."product" pr ON pr."id" = o."product_id"
WHERE p."id" = np."plan_id";

ALTER TABLE "public"."nutritional_plan"
  ALTER COLUMN "plan_name" SET NOT NULL,
  ALTER COLUMN "start_date" SET NOT NULL,
  ALTER COLUMN "goal" SET NOT NULL,
  ALTER COLUMN "diet_regimen" SET NOT NULL;
