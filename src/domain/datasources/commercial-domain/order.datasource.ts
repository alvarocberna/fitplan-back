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
}
