import { Injectable } from '@nestjs/common';
import { OrderRepository } from '../../../../domain/repositories/commercial-domain/order.repository';
import {
  OrderDatasource,
  OrderPaidExtras,
  PendingGenerationCriteria,
} from '../../../../domain/datasources/commercial-domain/order.datasource';
import { OrderEntity } from '../../../../domain/entities/order.entity';
import {
  CreateOrderDto,
  CreatePaymentDto,
  UpdateOrderDto,
} from '../../../../domain';

@Injectable()
export class OrderRepositoryImpl implements OrderRepository {
  constructor(private readonly datasource: OrderDatasource) {}

  createOrder(createOrderDto: CreateOrderDto): Promise<OrderEntity> {
    return this.datasource.createOrder(createOrderDto);
  }

  getOrderById(id: string): Promise<OrderEntity | null> {
    return this.datasource.getOrderById(id);
  }

  updateOrderById(
    id: string,
    updateOrderDto: UpdateOrderDto,
  ): Promise<OrderEntity> {
    return this.datasource.updateOrderById(id, updateOrderDto);
  }

  deleteOrderById(id: string): Promise<void> {
    return this.datasource.deleteOrderById(id);
  }

  getOrderWithUserById(id: string): Promise<OrderEntity | null> {
    return this.datasource.getOrderWithUserById(id);
  }

  getOrderWithProductById(id: string): Promise<OrderEntity | null> {
    return this.datasource.getOrderWithProductById(id);
  }

  getPaidOrdersWithPdfByUserId(userId: string): Promise<OrderEntity[]> {
    return this.datasource.getPaidOrdersWithPdfByUserId(userId);
  }

  getReadyOrderWithPlanDetailByIdAndUserId(
    id: string,
    userId: string,
  ): Promise<OrderEntity | null> {
    return this.datasource.getReadyOrderWithPlanDetailByIdAndUserId(id, userId);
  }

  markOrderAsPaidIfPending(id: string): Promise<boolean> {
    return this.datasource.markOrderAsPaidIfPending(id);
  }

  markOrderAsPaidWithPayment(
    id: string,
    payment: Omit<CreatePaymentDto, 'orderId'>,
    extras?: OrderPaidExtras,
  ): Promise<boolean> {
    return this.datasource.markOrderAsPaidWithPayment(id, payment, extras);
  }

  markOrderAsRejectedWithPayment(
    id: string,
    payment: Omit<CreatePaymentDto, 'orderId'>,
  ): Promise<boolean> {
    return this.datasource.markOrderAsRejectedWithPayment(id, payment);
  }

  expireOrderIfDue(id: string, now: Date): Promise<boolean> {
    return this.datasource.expireOrderIfDue(id, now);
  }

  getDueUnpaidOrderIds(now: Date, limit: number): Promise<string[]> {
    return this.datasource.getDueUnpaidOrderIds(now, limit);
  }

  tryTransitionOrderToGenerating(id: string): Promise<boolean> {
    return this.datasource.tryTransitionOrderToGenerating(id);
  }

  incrementOrderFailedAttempt(id: string): Promise<void> {
    return this.datasource.incrementOrderFailedAttempt(id);
  }

  releaseStalledGenerations(staleBefore: Date): Promise<number> {
    return this.datasource.releaseStalledGenerations(staleBefore);
  }

  getOrderIdsPendingGeneration(
    criteria: PendingGenerationCriteria,
  ): Promise<string[]> {
    return this.datasource.getOrderIdsPendingGeneration(criteria);
  }
}
