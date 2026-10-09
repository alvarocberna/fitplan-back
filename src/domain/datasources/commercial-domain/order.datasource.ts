import { OrderEntity } from '../../entities/order.entity';
import { CreateOrderDto, CreatePaymentDto, UpdateOrderDto } from '../..';

// Campos de la orden que se fijan en el mismo instante en que se confirma el pago (hoy: la copia
// del PDF/miniatura de un producto predefinido y su paso a COMPLETED).
export type OrderPaidExtras = Partial<
  Pick<UpdateOrderDto, 'pdfKey' | 'thumbnailKey' | 'generationStatus'>
>;

// Criterio de búsqueda de las órdenes pagadas de plan personalizado cuya generación hay que relanzar.
export interface PendingGenerationCriteria {
  // NOT_STARTED cuyo pago se confirmó antes de esta fecha (perdieron el disparo order.paid).
  notStartedPaidBefore: Date;
  // ERROR con reintentos disponibles: errorRetryDueBefore[i] es el límite para las órdenes con
  // i + 1 rondas fallidas (su último fallo debe ser anterior a esa fecha). Las órdenes con más
  // rondas fallidas que elementos tiene el arreglo ya no se reintentan.
  errorRetryDueBefore: Date[];
  limit: number;
}

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
  // desalineados. Se puede pagar desde PENDING o REJECTED (reintento) mientras no haya vencido el
  // plazo; si la orden ya estaba pagada, expirada o vencida devuelve false y no crea nada.
  // Con `paymentId` (pasarela real) no crea la fila: completa el intento INITIATED que ya existía.
  abstract markOrderAsPaidWithPayment(
    id: string,
    payment: Omit<CreatePaymentDto, 'orderId'>,
    extras?: OrderPaidExtras,
    paymentId?: string,
  ): Promise<boolean>;

  // Registra un intento de pago rechazado: en UNA transacción deja la orden REJECTED (solo si estaba
  // PENDING o REJECTED y no venció su plazo) y crea la fila `payment` del intento. Devuelve false, sin
  // crear nada, si la orden ya no admite pagos (pagada, expirada o vencida). Con `paymentId` completa
  // el intento INITIATED que ya existía en vez de crear la fila.
  abstract markOrderAsRejectedWithPayment(
    id: string,
    payment: Omit<CreatePaymentDto, 'orderId'>,
    paymentId?: string,
  ): Promise<boolean>;

  // Pasa a EXPIRED una orden sin pagar (PENDING o REJECTED) cuyo expiration_date ya pasó. Idempotente:
  // devuelve true solo si esta llamada fue la que la expiró.
  abstract expireOrderIfDue(id: string, now: Date): Promise<boolean>;

  // ids de las órdenes sin pagar con el plazo vencido (las más antiguas primero), para el job de
  // expiración.
  abstract getDueUnpaidOrderIds(now: Date, limit: number): Promise<string[]>;

  // guard de estado: solo entra a GENERATING si no estaba ya en ese estado (evita que dos
  // disparos concurrentes generen el plan dos veces).
  abstract tryTransitionOrderToGenerating(id: string): Promise<boolean>;

  abstract incrementOrderFailedAttempt(id: string): Promise<void>;

  // Da por fallida la ronda de las órdenes que llevan en GENERATING desde antes de `staleBefore`
  // (generación interrumpida): las deja en ERROR con attempts + 1 y sin espera pendiente, para que el
  // job las reintente de inmediato. Devuelve cuántas liberó.
  abstract releaseStalledGenerations(staleBefore: Date): Promise<number>;

  // ids de las órdenes pagadas de un producto GENERATED que hay que (re)generar, las de pago más
  // antiguo primero.
  abstract getOrderIdsPendingGeneration(
    criteria: PendingGenerationCriteria,
  ): Promise<string[]>;
}
