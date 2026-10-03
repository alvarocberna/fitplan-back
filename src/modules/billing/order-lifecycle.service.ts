import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { GenerationStatus, NutritionPlanDto } from '../../domain';
import { PaymentStatus } from '../../domain/entities/enums';
import { OrderEntity } from '../../domain/entities/order.entity';
import { OrderRepository } from '../../domain/repositories/commercial-domain/order.repository';
import { ORDER_EXPIRED, OrderExpiredEvent } from './events/order-expired.event';

// Plazo para pagar una orden desde que se crea. Vencido, la orden pasa a EXPIRED.
export const ORDER_PAYMENT_WINDOW_MS = 24 * 60 * 60 * 1000;

// Transiciones de estado de una orden (generationStatus y expiración). billing es el único módulo
// que escribe `order`: la generación del plan (plans) pasa por acá en vez de tocar el repositorio
// directamente.
@Injectable()
export class OrderLifecycleService {
  private readonly logger = new Logger(OrderLifecycleService.name);

  constructor(
    private readonly orderRepository: OrderRepository,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  // Expira la orden si sigue sin pagar y su plazo ya venció. Emite order.expired solo si esta
  // llamada fue la que la expiró (idempotente frente al job y a los chequeos al leer/pagar).
  async expireIfDue(orderId: string): Promise<boolean> {
    const expired = await this.orderRepository.expireOrderIfDue(
      orderId,
      new Date(),
    );
    if (!expired) return false;

    const event: OrderExpiredEvent = { orderId };
    this.eventEmitter.emit(ORDER_EXPIRED, event);
    this.logger.log(`Orden ${orderId}: expiró sin pagarse`);
    return true;
  }

  // ¿La orden ya no se puede pagar por haber vencido su plazo? Si venció y nadie la había expirado
  // todavía (el job corre cada pocos minutos), la expira en el momento.
  async isExpired(
    order: Pick<OrderEntity, 'id' | 'paymentStatus' | 'expirationDate'>,
  ): Promise<boolean> {
    if (order.paymentStatus === PaymentStatus.EXPIRED) return true;
    if (order.paymentStatus === PaymentStatus.PAID) return false;
    if (!order.expirationDate || order.expirationDate > new Date()) return false;

    await this.expireIfDue(order.id);
    return true;
  }

  // Orden con su usuario (para el email) y su producto (para el nombre del plan).
  async findByIdWithUser(id: string): Promise<OrderEntity> {
    const order = await this.orderRepository.getOrderWithUserById(id);
    if (!order) throw new NotFoundException(`Orden ${id} no encontrada`);
    return order;
  }

  // Guard de estado: solo entra a GENERATING si estaba NOT_STARTED o ERROR, para evitar que dos
  // disparos concurrentes (ej. reintento manual del webhook) generen el plan dos veces.
  tryStartGeneration(id: string): Promise<boolean> {
    return this.orderRepository.tryTransitionOrderToGenerating(id);
  }

  async completeGeneration(
    id: string,
    plan: NutritionPlanDto,
    pdfKey: string,
    thumbnailKey: string | null,
  ): Promise<void> {
    await this.orderRepository.updateOrderById(id, {
      generationStatus: GenerationStatus.COMPLETED,
      planJson: JSON.stringify(plan),
      pdfKey,
      thumbnailKey,
    });
  }

  async recordFailedAttempt(id: string): Promise<void> {
    await this.orderRepository.incrementOrderFailedAttempt(id);
  }
}
