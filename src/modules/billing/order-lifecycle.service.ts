import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { GenerationStatus, NutritionPlanDto } from '../../domain';
import { PaymentStatus } from '../../domain/entities/enums';
import { OrderEntity } from '../../domain/entities/order.entity';
import { OrderRepository } from '../../domain/repositories/commercial-domain/order.repository';
import {
  GENERATION_RETRY_DELAYS_MS,
  STALLED_GENERATION_MS,
  UNSTARTED_GENERATION_GRACE_MS,
} from '../../domain/services/orders/generation-retry.policy';
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
    if (!order.expirationDate || order.expirationDate > new Date())
      return false;

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

  // Marca de progreso de una generación en curso: renueva generationUpdatedAt. El job de reintentos
  // da por interrumpida una orden que lleva STALLED_GENERATION_MS en GENERATING sin esta marca, así
  // que una generación que sigue avanzando (varios intentos, correcciones) no se confunde con una
  // que quedó pegada.
  async touchGeneration(id: string): Promise<void> {
    await this.orderRepository.updateOrderById(id, {
      generationUpdatedAt: new Date(),
    });
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

  // Una ronda de generación agotó sus intentos: la orden queda en ERROR con attempts + 1. Mientras le
  // queden rondas, el job de reintentos la retoma (ver generation-retry.policy.ts).
  async recordFailedAttempt(id: string): Promise<void> {
    await this.orderRepository.incrementOrderFailedAttempt(id);
  }

  // Da por fallida la ronda de las órdenes que quedaron pegadas en GENERATING (el proceso se reinició
  // a mitad de la generación). Devuelve cuántas liberó.
  releaseStalledGenerations(): Promise<number> {
    return this.orderRepository.releaseStalledGenerations(
      new Date(Date.now() - STALLED_GENERATION_MS),
    );
  }

  // Órdenes pagadas de plan personalizado cuya generación hay que relanzar: en ERROR con reintentos
  // disponibles y la espera cumplida, o pagadas que nunca arrancaron (perdieron el evento order.paid).
  findOrderIdsPendingGeneration(limit: number): Promise<string[]> {
    const now = Date.now();
    return this.orderRepository.getOrderIdsPendingGeneration({
      notStartedPaidBefore: new Date(now - UNSTARTED_GENERATION_GRACE_MS),
      errorRetryDueBefore: GENERATION_RETRY_DELAYS_MS.map(
        (delayMs) => new Date(now - delayMs),
      ),
      limit,
    });
  }
}
