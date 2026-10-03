import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ProductType } from '../../../domain/entities/enums';
import { ORDER_PAID } from '../../billing/events/order-paid.event';
import type { OrderPaidEvent } from '../../billing/events/order-paid.event';
import { GeneratePersonalizedPlanUseCase } from '../use-cases/generate-personalized-plan.use-case';

// Reacciona al pago confirmado (billing) disparando la generación del plan personalizado. Un plan
// estándar ya viene con su PDF (se copió desde el producto al confirmar el pago): no hay nada que
// generar.
@Injectable()
export class OrderPaidListener {
  private readonly logger = new Logger(OrderPaidListener.name);

  constructor(
    private readonly generatePersonalizedPlan: GeneratePersonalizedPlanUseCase,
  ) {}

  @OnEvent(ORDER_PAID)
  handle(event: OrderPaidEvent): void {
    if (event.productType !== ProductType.GENERATED) return;

    // fire-and-forget: el caso de uso maneja sus propios reintentos y estados de error, así que este
    // catch es solo una red de seguridad contra errores realmente inesperados.
    this.generatePersonalizedPlan
      .execute({ orderId: event.orderId })
      .catch((error: Error) => {
        this.logger.error(
          `Orden ${event.orderId}: error no controlado al generar el plan: ${error.message}`,
          error.stack,
        );
      });
  }
}
