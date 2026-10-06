import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ORDER_EXPIRED } from '../../billing/events/order-expired.event';
import type { OrderExpiredEvent } from '../../billing/events/order-expired.event';
import { DeleteExpiredConsultationUseCase } from '../use-cases/delete-expired-consultation.use-case';

// Reacciona a la expiración de una orden sin pagar (billing) borrando la consulta que se había
// creado para ella.
@Injectable()
export class OrderExpiredListener {
  private readonly logger = new Logger(OrderExpiredListener.name);

  constructor(
    private readonly deleteExpiredConsultation: DeleteExpiredConsultationUseCase,
  ) {}

  @OnEvent(ORDER_EXPIRED)
  handle(event: OrderExpiredEvent): void {
    // fire-and-forget: quien expira la orden (job, pago o consulta de estado) no espera el borrado.
    // Si falla, la consulta queda oculta igual (las lecturas excluyen las de órdenes expiradas) y la
    // borra más tarde el barrido de PurgeExpiredConsultationsJob.
    this.deleteExpiredConsultation
      .execute({ orderId: event.orderId })
      .catch((error: Error) => {
        this.logger.error(
          `Orden ${event.orderId}: no se pudo borrar la consulta expirada: ${error.message}`,
          error.stack,
        );
      });
  }
}
