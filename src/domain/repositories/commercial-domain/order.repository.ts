import { OrderEntity } from '../../entities/order.entity';
import { CreateOrderDto, CreatePaymentDto, UpdateOrderDto } from '../..';
import type { OrderPaidExtras } from '../../datasources/commercial-domain/order.datasource';

export abstract class OrderRepository {
  abstract createOrder(createOrderDto: CreateOrderDto): Promise<OrderEntity>;
  abstract getOrderById(id: string): Promise<OrderEntity | null>;
  abstract updateOrderById(
    id: string,
    updateOrderDto: UpdateOrderDto,
  ): Promise<OrderEntity>;
  abstract deleteOrderById(id: string): Promise<void>;
  abstract getOrderWithUserById(id: string): Promise<OrderEntity | null>;
  abstract getOrderWithProductById(id: string): Promise<OrderEntity | null>;
  abstract getPaidOrdersWithPdfByUserId(userId: string): Promise<OrderEntity[]>;
  abstract markOrderAsPaidIfPending(id: string): Promise<boolean>;
  abstract markOrderAsPaidWithPayment(
    id: string,
    payment: Omit<CreatePaymentDto, 'orderId'>,
    extras?: OrderPaidExtras,
  ): Promise<boolean>;
  abstract tryTransitionOrderToGenerating(id: string): Promise<boolean>;
  abstract incrementOrderFailedAttempt(id: string): Promise<void>;}
