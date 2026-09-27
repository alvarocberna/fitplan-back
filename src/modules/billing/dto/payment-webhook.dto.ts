import { IsUUID } from 'class-validator';

// Cuerpo provisorio de la notificación de pago: se ajustará al formato real de la pasarela al
// integrar Transbank.
export class PaymentWebhookDtoImpl {
  @IsUUID('4')
  orderId!: string;
}
