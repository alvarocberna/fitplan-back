import { Injectable, Logger } from '@nestjs/common';
import { OrderRepository } from '../../../domain/repositories/commercial-domain/order.repository';
import { OrderLifecycleService } from '../order-lifecycle.service';

// Máximo de órdenes por corrida; si quedan más, las toma la corrida siguiente.
const BATCH_SIZE = 200;

// CU-BIL-05 (sin endpoint: lo dispara el job ExpireUnpaidOrdersJob). Expira las órdenes sin pagar
// (PENDING o REJECTED) cuyo plazo de pago venció. Por cada una se emite order.expired
// (OrderLifecycleService.expireIfDue), que es lo que borra la consulta asociada.
@Injectable()
export class ExpireUnpaidOrdersUseCase {
  private readonly logger = new Logger(ExpireUnpaidOrdersUseCase.name);

  constructor(
    private readonly orderRepository: OrderRepository,
    private readonly orderLifecycle: OrderLifecycleService,
  ) {}

  async execute(): Promise<{ expired: number }> {
    const orderIds = await this.orderRepository.getDueUnpaidOrderIds(
      new Date(),
      BATCH_SIZE,
    );

    let expired = 0;
    for (const orderId of orderIds) {
      // una orden que falla no debe frenar al resto: se reintenta en la corrida siguiente.
      try {
        if (await this.orderLifecycle.expireIfDue(orderId)) expired++;
      } catch (error) {
        this.logger.error(
          `Orden ${orderId}: no se pudo expirar: ${(error as Error).message}`,
        );
      }
    }

    if (expired > 0) this.logger.log(`${expired} orden(es) expiradas`);
    return { expired };
  }
}
