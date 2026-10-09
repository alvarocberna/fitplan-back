-- Integración de Webpay Plus (Transbank). Editada a mano:
-- 1. payment.status suma INITIATED: el intento de pago se registra al iniciarlo en la pasarela y se
--    completa con el resultado cuando el usuario vuelve.
-- 2. payment guarda el token de la transacción (único), el código de respuesta y los últimos dígitos
--    de la tarjeta; los campos de detalle pasan a ser nullable porque no existen hasta el resultado.

-- 1. Nuevo estado del intento de pago
ALTER TYPE "public"."PaymentTransactionStatus" ADD VALUE 'INITIATED' BEFORE 'AUTHORIZED';

-- 2. Columnas del intento de pago
ALTER TABLE "public"."payment"
  ADD COLUMN "token" TEXT,
  ADD COLUMN "response_code" INTEGER,
  ADD COLUMN "card_last_digits" TEXT,
  ADD COLUMN "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ALTER COLUMN "authorization_code" DROP NOT NULL,
  ALTER COLUMN "installment_count" DROP NOT NULL,
  ALTER COLUMN "transaction_date" DROP NOT NULL,
  ALTER COLUMN "movement_type" DROP NOT NULL,
  ALTER COLUMN "card_type" DROP NOT NULL;

CREATE UNIQUE INDEX "payment_token_key" ON "public"."payment"("token");
CREATE INDEX "payment_payment_identifier_idx" ON "public"."payment"("payment_identifier");
