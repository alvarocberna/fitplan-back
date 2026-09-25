-- Introduce la entidad `plan` entre nutritional_consultation/order y nutritional_plan
-- (1 orden -> 1 plan -> N nutritional_plan). Editada a mano: en vez de agregar `plan_id NOT NULL`
-- de golpe (falla si ya hay filas en nutritional_plan), se crea un `plan` por cada nutritional_plan
-- existente a partir de su consultation_id/order_id y recién después se eliminan esas columnas.

-- CreateTable
CREATE TABLE "public"."plan" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "consultation_id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "plan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "plan_order_id_key" ON "public"."plan"("order_id");

-- AddForeignKey
ALTER TABLE "public"."plan" ADD CONSTRAINT "plan_consultation_id_fkey" FOREIGN KEY ("consultation_id") REFERENCES "public"."nutritional_consultation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."plan" ADD CONSTRAINT "plan_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Backfill: los nutritional_plan sin order_id no tienen cómo colgar de un plan (plan.order_id es
-- obligatorio); el pipeline actual siempre lo setea, así que no debería haber ninguno.
DELETE FROM "public"."nutritional_plan" WHERE "order_id" IS NULL;

INSERT INTO "public"."plan" ("consultation_id", "order_id", "active")
SELECT "consultation_id", "order_id", true FROM "public"."nutritional_plan";

-- AlterTable
ALTER TABLE "public"."nutritional_plan" ADD COLUMN "plan_id" UUID,
ADD COLUMN     "plan_name" TEXT,
ADD COLUMN     "period" TEXT,
ADD COLUMN     "main_plan" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "start_date" DATE,
ADD COLUMN     "end_date" DATE;

UPDATE "public"."nutritional_plan" np
SET "plan_id" = p."id"
FROM "public"."plan" p
WHERE p."order_id" = np."order_id";

ALTER TABLE "public"."nutritional_plan" ALTER COLUMN "plan_id" SET NOT NULL;

-- DropForeignKey
ALTER TABLE "public"."nutritional_plan" DROP CONSTRAINT "nutritional_plan_consultation_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."nutritional_plan" DROP CONSTRAINT "nutritional_plan_order_id_fkey";

-- DropIndex
DROP INDEX "public"."nutritional_plan_order_id_key";

-- AlterTable
ALTER TABLE "public"."nutritional_plan" DROP COLUMN "consultation_id",
DROP COLUMN "order_id";

-- AddForeignKey
ALTER TABLE "public"."nutritional_plan" ADD CONSTRAINT "nutritional_plan_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "public"."plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "public"."dietary_recall_24h_meal" ADD COLUMN     "description" TEXT NOT NULL DEFAULT '';

-- AlterTable: *_formula -> *_method se renombran a mano (Prisma generaría DROP + ADD, perdiendo datos).
ALTER TABLE "public"."measurement_results" RENAME COLUMN "bf_formula" TO "bf_method";
ALTER TABLE "public"."measurement_results" RENAME COLUMN "vf_formula" TO "vf_method";
ALTER TABLE "public"."measurement_results" RENAME COLUMN "mm_formula" TO "mm_method";

ALTER TABLE "public"."measurement_results" ADD COLUMN     "bm_kg" DOUBLE PRECISION,
ADD COLUMN     "bm_percentage" DOUBLE PRECISION,
ADD COLUMN     "bm_classification" TEXT,
ADD COLUMN     "bm_method" TEXT;

-- CreateTable
CREATE TABLE "public"."projection" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "measurements_id" UUID NOT NULL,
    "projected_date" DATE,
    "projected_weight" DOUBLE PRECISION,
    "projected_bf_kg" DOUBLE PRECISION,
    "projected_bf_percentage" DOUBLE PRECISION,
    "projected_mm_kg" DOUBLE PRECISION,
    "projected_mm_percentage" DOUBLE PRECISION,
    "projected_bmi" DOUBLE PRECISION,

    CONSTRAINT "projection_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "public"."projection" ADD CONSTRAINT "projection_measurements_id_fkey" FOREIGN KEY ("measurements_id") REFERENCES "public"."measurements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
