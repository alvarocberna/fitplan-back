-- Prepara las tablas hijas de nutritional_plan para que la generación del plan las pueble
-- (GeneratePersonalizedPlanUseCase). Editada a mano:
-- 1. plan_supplement deja de ser único por nutritional_plan: el plan generado trae varios
--    suplementos (creatina, cafeína, nitrato, bicarbonato y whey protein si aplica).
-- 2. Nuevo tipo de nota EQUIVALENCE para plan_meal_time_note (alimentos equivalentes por grupo).
-- 3. ON DELETE CASCADE en las relaciones hijas: el upsert del plan reemplaza el nutritional_plan
--    principal (deleteMany + create) y, sin cascade, un reintento fallaría por FK.
-- 4. plan_meal_time.time y plan_supplement.requirement pasan a NOT NULL, como en el diagrama ER.
--    Hasta ahora ninguna de las dos tablas tenía filas (el pipeline no las poblaba).

-- 1. Un nutritional_plan puede tener varios suplementos
DROP INDEX "public"."plan_supplement_plan_id_key";

-- 2. Tipo de nota EQUIVALENCE
ALTER TYPE "public"."PlanMealTimeNoteType" ADD VALUE 'EQUIVALENCE';

-- 3. Cascada en las relaciones hijas
ALTER TABLE "public"."plan_meal_time" DROP CONSTRAINT "plan_meal_time_plan_id_fkey";
ALTER TABLE "public"."plan_meal_time" ADD CONSTRAINT "plan_meal_time_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "public"."nutritional_plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."plan_meal_time_note" DROP CONSTRAINT "plan_meal_time_note_plan_meal_time_id_fkey";
ALTER TABLE "public"."plan_meal_time_note" ADD CONSTRAINT "plan_meal_time_note_plan_meal_time_id_fkey" FOREIGN KEY ("plan_meal_time_id") REFERENCES "public"."plan_meal_time"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."plan_supplement" DROP CONSTRAINT "plan_supplement_plan_id_fkey";
ALTER TABLE "public"."plan_supplement" ADD CONSTRAINT "plan_supplement_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "public"."nutritional_plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."plan_supplement_note" DROP CONSTRAINT "plan_supplement_note_plan_supplement_id_fkey";
ALTER TABLE "public"."plan_supplement_note" ADD CONSTRAINT "plan_supplement_note_plan_supplement_id_fkey" FOREIGN KEY ("plan_supplement_id") REFERENCES "public"."plan_supplement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."plan_sports_recommendation" DROP CONSTRAINT "plan_sports_recommendation_plan_id_fkey";
ALTER TABLE "public"."plan_sports_recommendation" ADD CONSTRAINT "plan_sports_recommendation_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "public"."nutritional_plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 4. Columnas obligatorias según el diagrama ER
ALTER TABLE "public"."plan_meal_time" ALTER COLUMN "time" SET NOT NULL;
ALTER TABLE "public"."plan_supplement" ALTER COLUMN "requirement" SET NOT NULL;
