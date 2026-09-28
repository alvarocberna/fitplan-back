-- Backfill de measurement_results para las mediciones guardadas antes de que CU-CON-02, CU-CLI-05 y
-- CU-CLI-06 lo calcularan (calculateMeasurementResults). Sin cambios de schema. Editada a mano:
-- 1. Las mediciones de consulta con level NULL pasan a BASIC (la consulta solo recoge peso y talla).
-- 2. Las mediciones con peso y talla sin measurement_results reciben una fila con IMC y su
--    clasificación.
-- 3. En las filas existentes se completan el IMC y la clasificación faltantes y, en bioimpedancia,
--    el kg o % faltante de cada componente (grasa, masa muscular, grasa visceral, masa ósea).
-- Mismas reglas que el código: talla en cm (o en m si es < 10), redondeo a 2 decimales y rangos de
-- getBmiClassification (bmi.service.ts).

-- 1. Mediciones de consulta sin tipo -> BASIC
UPDATE "public"."measurements"
SET "level" = 'BASIC'
WHERE "consultation_id" IS NOT NULL AND "level" IS NULL;

-- Peso e IMC (sin redondear) de cada medición, tomados de su primera fila de basic_measurements.
CREATE TEMP TABLE "tmp_measurement_bmi" AS
SELECT DISTINCT ON (b."measurements_id")
  b."measurements_id",
  b."weight",
  b."weight" / power(CASE WHEN b."height" < 10 THEN b."height" ELSE b."height" / 100 END, 2) AS "bmi"
FROM "public"."basic_measurements" b
WHERE b."weight" IS NOT NULL AND b."height" IS NOT NULL AND b."height" > 0
ORDER BY b."measurements_id", b."id";

-- 2. Mediciones con peso y talla y sin measurement_results
INSERT INTO "public"."measurement_results" ("measurements_id", "bmi", "bmi_classification")
SELECT
  t."measurements_id",
  round(t."bmi"::numeric, 2)::double precision,
  CASE
    WHEN t."bmi" < 18.5 THEN 'UNDERWEIGHT'
    WHEN t."bmi" < 25 THEN 'NORMAL_WEIGHT'
    WHEN t."bmi" < 30 THEN 'OVERWEIGHT'
    WHEN t."bmi" < 35 THEN 'OBESITY_I'
    WHEN t."bmi" < 40 THEN 'OBESITY_II'
    ELSE 'OBESITY_III'
  END
FROM "tmp_measurement_bmi" t
WHERE NOT EXISTS (
  SELECT 1 FROM "public"."measurement_results" r WHERE r."measurements_id" = t."measurements_id"
);

-- 3a. IMC faltante en filas existentes
UPDATE "public"."measurement_results" r
SET
  "bmi" = round(t."bmi"::numeric, 2)::double precision,
  "bmi_classification" = CASE
    WHEN t."bmi" < 18.5 THEN 'UNDERWEIGHT'
    WHEN t."bmi" < 25 THEN 'NORMAL_WEIGHT'
    WHEN t."bmi" < 30 THEN 'OVERWEIGHT'
    WHEN t."bmi" < 35 THEN 'OBESITY_I'
    WHEN t."bmi" < 40 THEN 'OBESITY_II'
    ELSE 'OBESITY_III'
  END
FROM "tmp_measurement_bmi" t
WHERE r."measurements_id" = t."measurements_id" AND r."bmi" IS NULL;

-- 3b. kg o % faltante de cada componente (kg = % * peso / 100; % = kg * 100 / peso)
UPDATE "public"."measurement_results" r
SET
  "bf_kg" = COALESCE(r."bf_kg", round((r."bf_percentage" * t."weight" / 100)::numeric, 2)::double precision),
  "bf_percentage" = COALESCE(r."bf_percentage", round((r."bf_kg" * 100 / t."weight")::numeric, 2)::double precision),
  "mm_kg" = COALESCE(r."mm_kg", round((r."mm_percentage" * t."weight" / 100)::numeric, 2)::double precision),
  "mm_percentage" = COALESCE(r."mm_percentage", round((r."mm_kg" * 100 / t."weight")::numeric, 2)::double precision),
  "vf_kg" = COALESCE(r."vf_kg", round((r."vf_percentage" * t."weight" / 100)::numeric, 2)::double precision),
  "vf_percentage" = COALESCE(r."vf_percentage", round((r."vf_kg" * 100 / t."weight")::numeric, 2)::double precision),
  "bm_kg" = COALESCE(r."bm_kg", round((r."bm_percentage" * t."weight" / 100)::numeric, 2)::double precision),
  "bm_percentage" = COALESCE(r."bm_percentage", round((r."bm_kg" * 100 / t."weight")::numeric, 2)::double precision)
FROM "tmp_measurement_bmi" t
WHERE r."measurements_id" = t."measurements_id"
  AND t."weight" > 0
  AND (
    (r."bf_kg" IS NULL) <> (r."bf_percentage" IS NULL)
    OR (r."mm_kg" IS NULL) <> (r."mm_percentage" IS NULL)
    OR (r."vf_kg" IS NULL) <> (r."vf_percentage" IS NULL)
    OR (r."bm_kg" IS NULL) <> (r."bm_percentage" IS NULL)
  );

DROP TABLE "tmp_measurement_bmi";
