-- Reintento automático de la generación del plan (RetryPendingGenerationsUseCase): marca de tiempo del
-- último cambio de generation_status, para respetar la espera entre rondas y detectar generaciones
-- que quedaron interrumpidas en GENERATING. Las órdenes existentes quedan en NULL, que se trata como
-- "sin espera pendiente": una orden que ya estaba en ERROR o GENERATING se retoma en la primera
-- corrida del job.
ALTER TABLE "public"."order" ADD COLUMN "generation_updated_at" TIMESTAMP(3);
