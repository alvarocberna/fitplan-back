// Lo emite OrderLifecycleService cuando una orden sin pagar pasa efectivamente a EXPIRED (venció su
// plazo de pago). Así billing no depende de quién reacciona: hoy lo escucha consultation para borrar
// la consulta de la orden (OrderExpiredListener).
export const ORDER_EXPIRED = 'order.expired';

export interface OrderExpiredEvent {
  orderId: string;
}
