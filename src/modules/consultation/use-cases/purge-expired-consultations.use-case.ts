import { Injectable, Logger } from '@nestjs/common';
import { NutritionalConsultationRepository } from '../../../domain/repositories/clinical-domain/nutritional-consultation.repository';
import { DeleteExpiredConsultationUseCase } from './delete-expired-consultation.use-case';

// Máximo de consultas por corrida; si quedan más, las toma la corrida siguiente.
const BATCH_SIZE = 100;

// CU-CON-05 (sin endpoint: lo dispara el job PurgeExpiredConsultationsJob). Red de seguridad de
// CU-CON-04: borra las consultas que siguen existiendo aunque su orden ya expiró, porque el borrado
// disparado por order.expired falló o porque el evento (que vive en memoria) se perdió al reiniciarse
// el proceso. No depende del evento: mira el estado de la base.
@Injectable()
export class PurgeExpiredConsultationsUseCase {
  private readonly logger = new Logger(PurgeExpiredConsultationsUseCase.name);

  constructor(
    private readonly nutritionalConsultationRepository: NutritionalConsultationRepository,
    private readonly deleteExpiredConsultation: DeleteExpiredConsultationUseCase,
  ) {}

  async execute(): Promise<{ deleted: number }> {
    const orderIds =
      await this.nutritionalConsultationRepository.getOrderIdsOfConsultationsWithExpiredOrder(
        BATCH_SIZE,
      );

    let deleted = 0;
    for (const orderId of orderIds) {
      // una consulta que falla no debe frenar al resto: se reintenta en la corrida siguiente.
      try {
        const result = await this.deleteExpiredConsultation.execute({ orderId });
        if (result.deleted) deleted++;
      } catch (error) {
        this.logger.error(
          `Orden ${orderId}: no se pudo borrar la consulta expirada: ${(error as Error).message}`,
          (error as Error).stack,
        );
      }
    }

    if (deleted > 0) {
      this.logger.warn(`${deleted} consulta(s) de órdenes expiradas borradas por el barrido`);
    }
    return { deleted };
  }
}
