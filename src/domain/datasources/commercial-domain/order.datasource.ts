import { OrderEntity } from '../../entities/order.entity';
import { CreateOrderDto, UpdateOrderDto } from '../..';

export abstract class OrderDatasource {
  abstract createOrder(createOrderDto: CreateOrderDto): Promise<OrderEntity>;
  abstract getOrderById(id: string): Promise<OrderEntity | null>;
  abstract updateOrderById(
    id: string,
    updateOrderDto: UpdateOrderDto,
  ): Promise<OrderEntity>;
  abstract deleteOrderById(id: string): Promise<void>;

  abstract getOrderWithUserById(id: string): Promise<OrderEntity | null>;

  // órdenes con plan generado y PDF ya subido a S3, de un usuario, más nuevas primero (usado por
  // el listado del panel/GET /ordenes).
  abstract getPaidOrdersWithPdfByUserId(userId: string): Promise<OrderEntity[]>;

  // idempotente: devuelve true solo si esta llamada fue la que efectivamente marcó el pago.
  abstract markOrderAsPaidIfPending(id: string): Promise<boolean>;

  // guard de estado: solo entra a 'generando' si no estaba ya en ese estado (evita que dos
  // disparos concurrentes generen el plan dos veces).
  abstract tryTransitionOrderToGenerating(id: string): Promise<boolean>;

  abstract incrementOrderFailedAttempt(id: string): Promise<void>;

  // job de retención: anula planJson de órdenes anteriores a cutoffDate, conservando la fila.
  abstract anonymizeOldOrders(cutoffDate: Date): Promise<number>;
}
