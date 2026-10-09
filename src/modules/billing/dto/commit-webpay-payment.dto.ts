import { IsOptional, IsString, MaxLength } from 'class-validator';
import type { CommitWebpayPaymentInput } from '../use-cases/commit-webpay-payment.use-case';

// Largo máximo del token de una transacción de Webpay y de la orden de compra.
const TOKEN_MAX_LENGTH = 64;
const BUY_ORDER_MAX_LENGTH = 26;

// Parámetros con que Webpay devuelve al usuario, tal como los reenvía el frontend. Todos opcionales:
// cuáles vienen depende de cómo terminó el pago (ver CommitWebpayPaymentUseCase).
export class CommitWebpayPaymentDtoImpl implements CommitWebpayPaymentInput {
  @IsOptional()
  @IsString()
  @MaxLength(TOKEN_MAX_LENGTH)
  tokenWs?: string;

  @IsOptional()
  @IsString()
  @MaxLength(TOKEN_MAX_LENGTH)
  tbkToken?: string;

  @IsOptional()
  @IsString()
  @MaxLength(BUY_ORDER_MAX_LENGTH)
  tbkBuyOrder?: string;
}
