import { GenerationStatus, PaymentStatus } from '../../domain';
import { OrderEntity } from '../../domain/entities/order.entity';
import { isGenerationRetryPending } from '../../domain/services/orders/generation-retry.policy';
import { ConsultationPlanStatus } from './dto/consultation-summary.dto';

// Estado del plan de una consulta a partir de su orden (CU-CLI-01 y CU-CLI-02). El estado de
// generación manda sobre el de pago: una orden COMPLETED o ERROR ya está pagada.
export function toPlanStatus(
  order:
    | Pick<OrderEntity, 'paymentStatus' | 'generationStatus' | 'attempts'>
    | null
    | undefined,
): ConsultationPlanStatus | null {
  if (!order) return null;
  if (order.generationStatus === GenerationStatus.COMPLETED) return 'ready';
  // un fallo con reintentos automáticos pendientes sigue "generándose"; 'error' es solo el definitivo
  if (isGenerationRetryPending(order)) return 'generating';
  if (order.generationStatus === GenerationStatus.ERROR) return 'error';
  if (order.paymentStatus === PaymentStatus.PAID) return 'generating';
  // REJECTED sigue siendo pagable (reintento). EXPIRED no debería llegar acá: las consultas de
  // órdenes expiradas se borran y las lecturas las excluyen.
  if (order.paymentStatus === PaymentStatus.REJECTED) return 'payment_rejected';
  return 'awaiting_payment';
}
