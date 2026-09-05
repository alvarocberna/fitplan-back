import { Injectable } from '@nestjs/common';
import { OrderRepository } from '../../../domain/repositories/commercial-domain/order.repository';
import { OrderDatasource } from '../../../domain/datasources/commercial-domain/order.datasource';
import { OrderEntity } from '../../../domain/entities/order.entity';
import { CreateOrderDto, UpdateOrderDto } from '../../../domain';

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
}
