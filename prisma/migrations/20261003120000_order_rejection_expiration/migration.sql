-- Pago rechazado y expiración de órdenes sin pagar. Editada a mano:
-- 1. order.payment_status suma REJECTED (último intento de pago rechazado; se puede reintentar) y
--    EXPIRED (pasaron 24 h sin pagarse; terminal).
-- 2. ON DELETE CASCADE en el subárbol de anamnesis: al expirar una orden se borra su consulta
--    (DeleteExpiredConsultationUseCase) y la anamnesis cae con ella. measurements sigue en RESTRICT:
--    las mediciones se conservan en la ficha clínica, desvinculadas de la consulta.
-- 3. Backfill de expiration_date en las órdenes pendientes existentes (creation_date + 24 h): las que
--    ya superaron el plazo expiran en la primera corrida del job y se borran sus consultas.

-- 1. Nuevos estados de pago
ALTER TYPE "public"."PaymentStatus" ADD VALUE 'REJECTED';
ALTER TYPE "public"."PaymentStatus" ADD VALUE 'EXPIRED';

-- 2. Cascada en el subárbol de anamnesis
ALTER TABLE "public"."anamnesis" DROP CONSTRAINT "anamnesis_consultation_id_fkey";
ALTER TABLE "public"."anamnesis" ADD CONSTRAINT "anamnesis_consultation_id_fkey" FOREIGN KEY ("consultation_id") REFERENCES "public"."nutritional_consultation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."goals" DROP CONSTRAINT "goals_anamnesis_id_fkey";
ALTER TABLE "public"."goals" ADD CONSTRAINT "goals_anamnesis_id_fkey" FOREIGN KEY ("anamnesis_id") REFERENCES "public"."anamnesis"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."anamnesis_clinical" DROP CONSTRAINT "anamnesis_clinical_anamnesis_id_fkey";
ALTER TABLE "public"."anamnesis_clinical" ADD CONSTRAINT "anamnesis_clinical_anamnesis_id_fkey" FOREIGN KEY ("anamnesis_id") REFERENCES "public"."anamnesis"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."clinical_condition" DROP CONSTRAINT "clinical_condition_anamnesis_clinical_id_fkey";
ALTER TABLE "public"."clinical_condition" ADD CONSTRAINT "clinical_condition_anamnesis_clinical_id_fkey" FOREIGN KEY ("anamnesis_clinical_id") REFERENCES "public"."anamnesis_clinical"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."anamnesis_dietary" DROP CONSTRAINT "anamnesis_dietary_anamnesis_id_fkey";
ALTER TABLE "public"."anamnesis_dietary" ADD CONSTRAINT "anamnesis_dietary_anamnesis_id_fkey" FOREIGN KEY ("anamnesis_id") REFERENCES "public"."anamnesis"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."dietary_recall_24h" DROP CONSTRAINT "dietary_recall_24h_anamnesis_dietary_id_fkey";
ALTER TABLE "public"."dietary_recall_24h" ADD CONSTRAINT "dietary_recall_24h_anamnesis_dietary_id_fkey" FOREIGN KEY ("anamnesis_dietary_id") REFERENCES "public"."anamnesis_dietary"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."dietary_recall_24h_meal" DROP CONSTRAINT "dietary_recall_24h_meal_dietary_recall_24h_id_fkey";
ALTER TABLE "public"."dietary_recall_24h_meal" ADD CONSTRAINT "dietary_recall_24h_meal_dietary_recall_24h_id_fkey" FOREIGN KEY ("dietary_recall_24h_id") REFERENCES "public"."dietary_recall_24h"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."food_preference" DROP CONSTRAINT "food_preference_anamnesis_dietary_id_fkey";
ALTER TABLE "public"."food_preference" ADD CONSTRAINT "food_preference_anamnesis_dietary_id_fkey" FOREIGN KEY ("anamnesis_dietary_id") REFERENCES "public"."anamnesis_dietary"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."food_preference_group" DROP CONSTRAINT "food_preference_group_food_preference_id_fkey";
ALTER TABLE "public"."food_preference_group" ADD CONSTRAINT "food_preference_group_food_preference_id_fkey" FOREIGN KEY ("food_preference_id") REFERENCES "public"."food_preference"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."supplements" DROP CONSTRAINT "supplements_anamnesis_dietary_id_fkey";
ALTER TABLE "public"."supplements" ADD CONSTRAINT "supplements_anamnesis_dietary_id_fkey" FOREIGN KEY ("anamnesis_dietary_id") REFERENCES "public"."anamnesis_dietary"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."anamnesis_psychosocial" DROP CONSTRAINT "anamnesis_psychosocial_anamnesis_id_fkey";
ALTER TABLE "public"."anamnesis_psychosocial" ADD CONSTRAINT "anamnesis_psychosocial_anamnesis_id_fkey" FOREIGN KEY ("anamnesis_id") REFERENCES "public"."anamnesis"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."lifestyle" DROP CONSTRAINT "lifestyle_anamnesis_id_fkey";
ALTER TABLE "public"."lifestyle" ADD CONSTRAINT "lifestyle_anamnesis_id_fkey" FOREIGN KEY ("anamnesis_id") REFERENCES "public"."anamnesis"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."sports_session" DROP CONSTRAINT "sports_session_lifestyle_id_fkey";
ALTER TABLE "public"."sports_session" ADD CONSTRAINT "sports_session_lifestyle_id_fkey" FOREIGN KEY ("lifestyle_id") REFERENCES "public"."lifestyle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."sports_strategy" DROP CONSTRAINT "sports_strategy_lifestyle_id_fkey";
ALTER TABLE "public"."sports_strategy" ADD CONSTRAINT "sports_strategy_lifestyle_id_fkey" FOREIGN KEY ("lifestyle_id") REFERENCES "public"."lifestyle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 3. Plazo de pago de las órdenes pendientes existentes
UPDATE "public"."order"
SET "expiration_date" = "creation_date" + INTERVAL '24 hours'
WHERE "payment_status" = 'PENDING' AND "expiration_date" IS NULL;
