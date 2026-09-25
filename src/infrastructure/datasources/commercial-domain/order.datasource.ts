import { Injectable } from '@nestjs/common';
import { Order as PrismaOrder } from '../../../../generated/prisma';
import { PrismaService } from '../../orm/prisma/prisma.service';
import {
  OrderDatasource,
  OrderPaidExtras,
} from '../../../domain/datasources/commercial-domain/order.datasource';
import {
  OrderEntity,
  OrderStatus,
  OrderGenerationStatus,
} from '../../../domain/entities/order.entity';
import { ProductType } from '../../../domain/entities/product.entity';
import {
  CreateOrderDto,
  CreatePaymentDto,
  UpdateOrderDto,
} from '../../../domain';

@Injectable()
export class OrderDatasourceImpl implements OrderDatasource {
  constructor(private readonly prisma: PrismaService) {}

  // `paymentStatus` se guarda como String en Postgres (sin enum nativo en el schema); se castea
  // acá porque las escrituras siempre pasan por CreateOrderDto/UpdateOrderDto, que ya lo tipan
  // como OrderStatus. Genérico en T para poder reusarlo con resultados que traen relaciones
  // incluidas (ej. getOrderWithUserById con `user`).
  private toEntity<T extends PrismaOrder>(order: T): OrderEntity {
    return {
      ...order,
      amount: order.amount.toNumber(),
      paymentStatus: order.paymentStatus as OrderStatus,
      generationStatus: order.generationStatus as OrderGenerationStatus,
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

  // Incluye también `product`: plan-generation usa su nombre como NutritionalPlan.planName.
  async getOrderWithUserById(id: string): Promise<OrderEntity | null> {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: { user: true, product: true },
    });
    return order
      ? {
          ...this.toEntity(order),
          product: {
            ...order.product,
            price: order.product.price.toNumber(),
            type: order.product.type as ProductType,
          },
        }
      : null;
  }

  async getOrderWithProductById(id: string): Promise<OrderEntity | null> {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: { product: true },
    });
    return order
      ? {
          ...this.toEntity(order),
          product: {
            ...order.product,
            price: order.product.price.toNumber(),
            type: order.product.type as ProductType,
          },
        }
      : null;
  }

  async getPaidOrdersWithPdfByUserId(userId: string): Promise<OrderEntity[]> {
    const orders = await this.prisma.order.findMany({
      where: { userId, generationStatus: 'completado', pdfKey: { not: null } },
      orderBy: { creationDate: 'desc' },
    });
    return orders.map((order) => this.toEntity(order));
  }

  async markOrderAsPaidIfPending(id: string): Promise<boolean> {
    const { count } = await this.prisma.order.updateMany({
      where: { id, paymentStatus: 'pendiente' },
      data: { paymentStatus: 'pagado' },
    });
    return count > 0;
  }

  async markOrderAsPaidWithPayment(
    id: string,
    payment: Omit<CreatePaymentDto, 'orderId'>,
    extras: OrderPaidExtras = {},
  ): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      // mismo guard de idempotencia que markOrderAsPaidIfPending: solo la primera llamada avanza.
      const { count } = await tx.order.updateMany({
        where: { id, paymentStatus: 'pendiente' },
        data: { ...extras, paymentStatus: 'pagado', paymentDate: new Date() },
      });
      if (count === 0) return false;

      await tx.payment.create({ data: { ...payment, orderId: id } });
      return true;
    });
  }

  async tryTransitionOrderToGenerating(id: string): Promise<boolean> {
    const { count } = await this.prisma.order.updateMany({
      where: { id, generationStatus: { in: ['no_iniciado', 'error'] } },
      data: { generationStatus: 'generando' },
    });
    return count > 0;
  }

  async incrementOrderFailedAttempt(id: string): Promise<void> {
    await this.prisma.order.update({
      where: { id },
      data: { generationStatus: 'error', attempts: { increment: 1 } },
    });
  }
}
