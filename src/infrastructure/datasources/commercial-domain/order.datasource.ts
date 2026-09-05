import { Injectable } from '@nestjs/common';
import { Order as PrismaOrder } from '../../../../generated/prisma';
import { PrismaService } from '../../orm/prisma/prisma.service';
import { OrderDatasource } from '../../../domain/datasources/commercial-domain/order.datasource';
import {
  OrderEntity,
  OrderStatus,
} from '../../../domain/entities/order.entity';
import { CreateOrderDto, UpdateOrderDto } from '../../../domain';

@Injectable()
export class OrderDatasourceImpl implements OrderDatasource {
  constructor(private readonly prisma: PrismaService) {}

  // `amount` es Decimal(12,2) en Postgres (Prisma lo devuelve como instancia Decimal, no number);
  // `status` se guarda como String (sin enum nativo en el schema) y ya llega validado vía CreateOrderDto.
  private toEntity(order: PrismaOrder): OrderEntity {
    return {
      ...order,
      amount: order.amount.toNumber(),
      status: order.status as OrderStatus,
    };
  }

  async createOrder(createOrderDto: CreateOrderDto): Promise<OrderEntity> {
    const order = await this.prisma.order.create({ data: createOrderDto });
    return this.toEntity(order);
  }

  async getOrderById(id: string): Promise<OrderEntity | null> {
    const order = await this.prisma.order.findUnique({ where: { id } });
    return order ? this.toEntity(order) : null;
  }

  async updateOrderById(
    id: string,
    updateOrderDto: UpdateOrderDto,
  ): Promise<OrderEntity> {
    const order = await this.prisma.order.update({
      where: { id },
      data: updateOrderDto,
    });
    return this.toEntity(order);
  }

  async deleteOrderById(id: string): Promise<void> {
    await this.prisma.order.delete({ where: { id } });
  }
}
