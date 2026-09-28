import { OrderEntity } from '../../entities/order.entity';
import { CreateOrderDto, CreatePaymentDto, UpdateOrderDto } from '../..';

// Campos de la orden que se fijan en el mismo instante en que se confirma el pago (hoy: la copia
// del PDF/miniatura de un producto predefinido y su paso a COMPLETED).
export type OrderPaidExtras = Partial<
  Pick<UpdateOrderDto, 'pdfKey' | 'thumbnailKey' | 'generationStatus'>
>;

export abstract class OrderDatasource {
  abstract createOrder(createOrderDto: CreateOrderDto): Promise<OrderEntity>;
  abstract getOrderById(id: string): Promise<OrderEntity | null>;
  abstract updateOrderById(
    id: string,
    updateOrderDto: UpdateOrderDto,
  ): Promise<OrderEntity>;
  abstract deleteOrderById(id: string): Promise<void>;

  abstract getOrderWithUserById(id: string): Promise<OrderEntity | null>;

  // orden con su producto incluido (usado por el webhook de pago para decidir qué hacer según
  // product.type).
  abstract getOrderWithProductById(id: string): Promise<OrderEntity | null>;

  // órdenes con plan generado y PDF ya subido a S3, de un usuario, más nuevas primero (usado por
  // el listado del panel/GET /me/plans).
  abstract getPaidOrdersWithPdfByUserId(userId: string): Promise<OrderEntity[]>;
  // Orden lista (COMPLETED + pdfKey) SOLO si es del usuario (R2: null si no existe, no es suya o no
  // está lista), con su product y el plan -> nutritionalPlan principal con todas sus tablas hijas.
  // Usada por GET /me/plans/:orderId (CU-PLN-05).
  abstract getReadyOrderWithPlanDetailByIdAndUserId(
    id: string,
    userId: string,
  ): Promise<OrderEntity | null>;

  // idempotente: devuelve true solo si esta llamada fue la que efectivamente marcó el pago.
  abstract markOrderAsPaidIfPending(id: string): Promise<boolean>;

  // Igual que markOrderAsPaidIfPending, pero en UNA transacción también crea la fila `payment` de la
  // orden y aplica `extras` sobre ella, para que order.payment_status y payment.status no queden
  // desalineados. Si la orden ya estaba pagada devuelve false y no crea nada (idempotente).
  abstract markOrderAsPaidWithPayment(
    id: string,
    payment: Omit<CreatePaymentDto, 'orderId'>,
    extras?: OrderPaidExtras,
  ): Promise<boolean>;

  // guard de estado: solo entra a GENERATING si no estaba ya en ese estado (evita que dos
  // disparos concurrentes generen el plan dos veces).
  abstract tryTransitionOrderToGenerating(id: string): Promise<boolean>;

  abstract incrementOrderFailedAttempt(id: string): Promise<void>;
}
