import { Injectable } from '@nestjs/common';
import { Prisma, Order as PrismaOrder } from '../../../../../generated/prisma';
import { PrismaService } from '../../orm/prisma/prisma.service';
import {
  OrderDatasource,
  OrderPaidExtras,
  PendingGenerationCriteria,
} from '../../../../domain/datasources/commercial-domain/order.datasource';
import { OrderEntity } from '../../../../domain/entities/order.entity';
import {
  GenerationStatus,
  PaymentStatus,
  PaymentTransactionStatus,
  ProductType,
} from '../../../../domain/entities/enums';
import {
  CreateOrderDto,
  CreatePaymentDto,
  UpdateOrderDto,
} from '../../../../domain';

// Campos de product que exponen GET /me/plans y /me/plans/:orderId (sin `price`, que es Decimal).
const PRODUCT_PLAN_SELECT = {
  type: true,
  name: true,
  description: true,
  goal: true,
  dietRegimen: true,
  calorieIntake: true,
  proteinIntake: true,
  carbohydrateIntake: true,
  lipidIntake: true,
} satisfies Prisma.ProductSelect;

// Lista de mis planes: product + resumen del NutritionalPlan principal (sin tablas hijas).
const PLAN_SUMMARY_INCLUDE = {
  product: { select: PRODUCT_PLAN_SELECT },
  plan: { include: { nutritionalPlans: { where: { mainPlan: true } } } },
} satisfies Prisma.OrderInclude;

// Detalle de un plan: lo mismo más todas las tablas hijas del NutritionalPlan principal.
const PLAN_DETAIL_INCLUDE = {
  product: { select: PRODUCT_PLAN_SELECT },
  plan: {
    include: {
      nutritionalPlans: {
        where: { mainPlan: true },
        include: {
          mealTimes: { include: { notes: true } },
          supplements: { include: { notes: true } },
          sportsRecommendations: true,
        },
      },
    },
  },
} satisfies Prisma.OrderInclude;

// Estados desde los que una orden todavía se puede pagar (REJECTED admite reintento).
const UNPAID_STATUSES = [PaymentStatus.PENDING, PaymentStatus.REJECTED];

// Orden sin pagar cuyo plazo de pago sigue vigente (expiration_date null = sin plazo).
const payableOrderWhere = (id: string, now: Date): Prisma.OrderWhereInput => ({
  id,
  paymentStatus: { in: UNPAID_STATUSES },
  OR: [{ expirationDate: null }, { expirationDate: { gt: now } }],
});

@Injectable()
export class OrderDatasourceImpl implements OrderDatasource {
  constructor(private readonly prisma: PrismaService) {}

  // Convierte el Decimal de `amount` a number. Genérico en T para poder reusarlo con resultados
  // que traen relaciones incluidas (ej. getOrderWithUserById con `user`).
  private toEntity<T extends PrismaOrder>(order: T): OrderEntity {
    return {
      ...order,
      amount: order.amount.toNumber(),
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
          },
        }
      : null;
  }

  async getPaidOrdersWithPdfByUserId(userId: string): Promise<OrderEntity[]> {
    const orders = await this.prisma.order.findMany({
      where: { userId, generationStatus: GenerationStatus.COMPLETED, pdfKey: { not: null } },
      orderBy: { creationDate: 'desc' },
      include: PLAN_SUMMARY_INCLUDE,
    });
    // product viene parcial (select), por eso el cast.
    return orders.map((order) => this.toEntity(order) as unknown as OrderEntity);
  }

  async getReadyOrderWithPlanDetailByIdAndUserId(
    id: string,
    userId: string,
  ): Promise<OrderEntity | null> {
    const order = await this.prisma.order.findFirst({
      where: {
        id,
        userId,
        generationStatus: GenerationStatus.COMPLETED,
        pdfKey: { not: null },
      },
      include: PLAN_DETAIL_INCLUDE,
    });
    return order ? (this.toEntity(order) as unknown as OrderEntity) : null;
  }

  async markOrderAsPaidIfPending(id: string): Promise<boolean> {
    const { count } = await this.prisma.order.updateMany({
      where: { id, paymentStatus: PaymentStatus.PENDING },
      data: { paymentStatus: PaymentStatus.PAID },
    });
    return count > 0;
  }

  async markOrderAsPaidWithPayment(
    id: string,
    payment: Omit<CreatePaymentDto, 'orderId'>,
    extras: OrderPaidExtras = {},
    paymentId?: string,
  ): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      // guard de idempotencia: solo avanza la primera llamada sobre una orden aún pagable.
      const now = new Date();
      const { count } = await tx.order.updateMany({
        where: payableOrderWhere(id, now),
        data: {
          ...extras,
          paymentStatus: PaymentStatus.PAID,
          paymentDate: now,
        },
      });
      if (count === 0) return false;

      await this.writePayment(tx, id, payment, paymentId);
      return true;
    });
  }

  // Deja registrado el resultado de un intento de pago dentro de la transacción que mueve la orden:
  // crea la fila (pago simulado) o completa el intento INITIATED de la pasarela. Si ese intento ya no
  // estaba INITIATED lanza, para deshacer el cambio de la orden.
  private async writePayment(
    tx: Prisma.TransactionClient,
    orderId: string,
    payment: Omit<CreatePaymentDto, 'orderId'>,
    paymentId?: string,
  ): Promise<void> {
    if (!paymentId) {
      await tx.payment.create({ data: { ...payment, orderId } });
      return;
    }
    const { count } = await tx.payment.updateMany({
      where: { id: paymentId, orderId, status: PaymentTransactionStatus.INITIATED },
      data: payment,
    });
    if (count === 0) {
      throw new Error(
        `Pago ${paymentId} de la orden ${orderId}: ya no estaba INITIATED al registrar su resultado`,
      );
    }
  }

  async markOrderAsRejectedWithPayment(
    id: string,
    payment: Omit<CreatePaymentDto, 'orderId'>,
    paymentId?: string,
  ): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      const { count } = await tx.order.updateMany({
        where: payableOrderWhere(id, new Date()),
        data: { paymentStatus: PaymentStatus.REJECTED },
      });
      if (count === 0) return false;

      await this.writePayment(tx, id, payment, paymentId);
      return true;
    });
  }

  async expireOrderIfDue(id: string, now: Date): Promise<boolean> {
    const { count } = await this.prisma.order.updateMany({
      where: {
        id,
        paymentStatus: { in: UNPAID_STATUSES },
        expirationDate: { lte: now },
      },
      data: { paymentStatus: PaymentStatus.EXPIRED },
    });
    return count > 0;
  }

  async getDueUnpaidOrderIds(now: Date, limit: number): Promise<string[]> {
    const orders = await this.prisma.order.findMany({
      where: {
        paymentStatus: { in: UNPAID_STATUSES },
        expirationDate: { lte: now },
      },
      orderBy: { expirationDate: 'asc' },
      take: limit,
      select: { id: true },
    });
    return orders.map((order) => order.id);
  }

  async tryTransitionOrderToGenerating(id: string): Promise<boolean> {
    const { count } = await this.prisma.order.updateMany({
      where: {
        id,
        generationStatus: {
          in: [GenerationStatus.NOT_STARTED, GenerationStatus.ERROR],
        },
      },
      data: {
        generationStatus: GenerationStatus.GENERATING,
        generationUpdatedAt: new Date(),
      },
    });
    return count > 0;
  }

  async incrementOrderFailedAttempt(id: string): Promise<void> {
    await this.prisma.order.update({
      where: { id },
      data: {
        generationStatus: GenerationStatus.ERROR,
        attempts: { increment: 1 },
        generationUpdatedAt: new Date(),
      },
    });
  }

  async releaseStalledGenerations(staleBefore: Date): Promise<number> {
    const { count } = await this.prisma.order.updateMany({
      where: {
        generationStatus: GenerationStatus.GENERATING,
        OR: [
          { generationUpdatedAt: null },
          { generationUpdatedAt: { lte: staleBefore } },
        ],
      },
      // generationUpdatedAt null = sin espera pendiente: se reintenta en esta misma corrida del job
      // (si aún le quedan rondas).
      data: {
        generationStatus: GenerationStatus.ERROR,
        attempts: { increment: 1 },
        generationUpdatedAt: null,
      },
    });
    return count;
  }

  async getOrderIdsPendingGeneration(
    criteria: PendingGenerationCriteria,
  ): Promise<string[]> {
    const { notStartedPaidBefore, errorRetryDueBefore, limit } = criteria;
    const orders = await this.prisma.order.findMany({
      where: {
        paymentStatus: PaymentStatus.PAID,
        product: { type: ProductType.GENERATED },
        OR: [
          {
            generationStatus: GenerationStatus.NOT_STARTED,
            paymentDate: { lte: notStartedPaidBefore },
          },
          // una condición por cantidad de rondas fallidas, cada una con su espera
          ...errorRetryDueBefore.map((dueBefore, index) => ({
            generationStatus: GenerationStatus.ERROR,
            attempts: index + 1,
            OR: [
              { generationUpdatedAt: null },
              { generationUpdatedAt: { lte: dueBefore } },
            ],
          })),
        ],
      },
      orderBy: { paymentDate: 'asc' },
      take: limit,
      select: { id: true },
    });
    return orders.map((order) => order.id);
  }
}
