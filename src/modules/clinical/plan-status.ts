import { GenerationStatus, PaymentStatus } from '../../domain';
import { OrderEntity } from '../../domain/entities/order.entity';
import { ConsultationPlanStatus } from './dto/consultation-summary.dto';

// Estado del plan de una consulta a partir de su orden (CU-CLI-01 y CU-CLI-02). El estado de
// generación manda sobre el de pago: una orden COMPLETED o ERROR ya está pagada.
export function toPlanStatus(
  order:
    | Pick<OrderEntity, 'paymentStatus' | 'generationStatus'>
    | null
    | undefined,
): ConsultationPlanStatus | null {
  if (!order) return null;
  if (order.generationStatus === GenerationStatus.COMPLETED) return 'ready';
  if (order.generationStatus === GenerationStatus.ERROR) return 'error';
  if (order.paymentStatus === PaymentStatus.PENDING) return 'awaiting_payment';
  return 'generating';
}
