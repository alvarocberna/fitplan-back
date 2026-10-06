import { ProductType } from '../../../domain/entities/enums';

// Lo emite ConfirmPaymentUseCase cuando una orden pasa efectivamente a PAID (no en un reintento
// idempotente del webhook). Así billing no depende de quién reacciona al pago: hoy lo escucha
// plans para generar el plan personalizado (OrderPaidListener).
export const ORDER_PAID = 'order.paid';

export interface OrderPaidEvent {
  orderId: string;
  productType: ProductType;
}
