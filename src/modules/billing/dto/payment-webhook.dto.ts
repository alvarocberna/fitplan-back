import { IsIn, IsOptional, IsUUID } from 'class-validator';
import { PaymentTransactionStatus } from '../../../domain/entities/enums';

const WEBHOOK_STATUSES = [
  PaymentTransactionStatus.AUTHORIZED,
  PaymentTransactionStatus.REJECTED,
] as const;

// Cuerpo provisorio de la notificación de pago: se ajustará al formato real de la pasarela al
// integrar Transbank.
export class PaymentWebhookDtoImpl {
  @IsUUID('4')
  orderId!: string;

  // Resultado del intento de pago. Si no viene se asume autorizado.
  @IsOptional()
  @IsIn(WEBHOOK_STATUSES)
  status?: (typeof WEBHOOK_STATUSES)[number];
}
