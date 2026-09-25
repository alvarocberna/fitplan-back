-- AlterTable
ALTER TABLE "public"."product" ADD COLUMN     "calorie_intake" DOUBLE PRECISION,
ADD COLUMN     "carbohydrate_intake" DOUBLE PRECISION,
ADD COLUMN     "diet_regimen" TEXT,
ADD COLUMN     "goal" TEXT,
ADD COLUMN     "lipid_intake" DOUBLE PRECISION,
ADD COLUMN     "protein_intake" DOUBLE PRECISION;
