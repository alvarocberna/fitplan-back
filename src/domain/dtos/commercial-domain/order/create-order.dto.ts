import { OrderEntity } from '../../../entities/order.entity';

export type CreateOrderDto = Omit<
  OrderEntity,
  'id' | 'user' | 'product' | 'payments' | 'nutritionalPlan'
>;
