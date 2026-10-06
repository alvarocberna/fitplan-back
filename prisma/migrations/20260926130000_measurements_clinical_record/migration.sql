-- measurements deja de depender obligatoriamente de nutritional_consultation. Escrita a mano: Prisma
-- agregaría las columnas NOT NULL sin poder rellenar las filas existentes.
--   * clinical_record_id (NOT NULL): toda medición pertenece al historial clínico del paciente
--   * consultation_id pasa a nullable: null = medición registrada por el usuario, sin consulta
--   * measured_at (NOT NULL, default now()): fecha de la medición

ALTER TABLE "public"."measurements"
  ADD COLUMN "clinical_record_id" UUID,
  ADD COLUMN "measured_at" TIMESTAMP(3);

-- Las mediciones existentes vienen todas de una consulta: heredan su historial y su fecha.
UPDATE "public"."measurements" AS m
SET "clinical_record_id" = nc."clinical_record_id",
    "measured_at" = nc."consultation_date"
FROM "public"."nutritional_consultation" AS nc
WHERE m."consultation_id" = nc."id";

ALTER TABLE "public"."measurements"
  ALTER COLUMN "clinical_record_id" SET NOT NULL,
  ALTER COLUMN "measured_at" SET NOT NULL,
  ALTER COLUMN "measured_at" SET DEFAULT CURRENT_TIMESTAMP,
  ALTER COLUMN "consultation_id" DROP NOT NULL;

ALTER TABLE "public"."measurements" ADD CONSTRAINT "measurements_clinical_record_id_fkey" FOREIGN KEY ("clinical_record_id") REFERENCES "public"."clinical_record"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "measurements_clinical_record_id_measured_at_idx" ON "public"."measurements"("clinical_record_id", "measured_at");
