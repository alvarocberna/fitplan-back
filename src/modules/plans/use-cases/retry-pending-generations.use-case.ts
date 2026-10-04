import { Injectable, Logger } from '@nestjs/common';
import { OrderLifecycleService } from '../../billing/order-lifecycle.service';
import { GeneratePersonalizedPlanUseCase } from './generate-personalized-plan.use-case';

// Máximo de órdenes por corrida: se generan una tras otra (cada generación son varias llamadas al
// modelo); si quedan más, las toma la corrida siguiente.
const BATCH_SIZE = 5;

// CU-PLN-08 (sin endpoint: lo dispara el job RetryPendingGenerationsJob). Relanza la generación del
// plan de las órdenes pagadas que quedaron sin plan:
//  - en ERROR con reintentos disponibles y la espera entre rondas cumplida (15 min, 1 h, 4 h);
//  - pegadas en GENERATING (el proceso se reinició a mitad de la generación);
//  - pagadas que nunca arrancaron (order.paid es un evento en memoria y se perdió).
// Agotadas las rondas (generation-retry.policy.ts) la orden queda en ERROR definitivo.
@Injectable()
export class RetryPendingGenerationsUseCase {
  private readonly logger = new Logger(RetryPendingGenerationsUseCase.name);

  constructor(
    private readonly orderLifecycle: OrderLifecycleService,
    private readonly generatePersonalizedPlan: GeneratePersonalizedPlanUseCase,
  ) {}

  async execute(): Promise<{ released: number; retried: number }> {
    const startedAt = Date.now();
    // primero: las generaciones interrumpidas pasan a ERROR (cuenta como ronda fallida) y quedan
    // disponibles para la búsqueda de abajo.
    const released = await this.orderLifecycle.releaseStalledGenerations();
    if (released > 0) {
      this.logger.warn(`${released} generación(es) interrumpidas dadas por fallidas`);
    }

    const orderIds =
      await this.orderLifecycle.findOrderIdsPendingGeneration(BATCH_SIZE);

    for (const orderId of orderIds) {
      this.logger.log(`Orden ${orderId}: se relanza la generación del plan`);
      // GeneratePersonalizedPlanUseCase contiene sus propios errores y deja la orden en ERROR si la
      // ronda falla; este catch es una red de seguridad para que una orden no frene al resto.
      try {
        await this.generatePersonalizedPlan.execute({ orderId, trigger: 'retry' });
      } catch (error) {
        this.logger.error(
          `Orden ${orderId}: error no controlado al reintentar la generación: ${(error as Error).message}`,
          (error as Error).stack,
        );
      }
    }

    if (orderIds.length > 0) {
      this.logger.log(
        `Corrida de reintentos: ${orderIds.length} orden(es) relanzadas en ${Date.now() - startedAt} ms`,
      );
    }
    return { released, retried: orderIds.length };
  }
}
