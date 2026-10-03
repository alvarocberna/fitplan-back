import { Injectable, Logger } from '@nestjs/common';
import { NutritionalConsultationRepository } from '../../../domain/repositories/clinical-domain/nutritional-consultation.repository';

// CU-CON-04 (sin endpoint: lo dispara el evento order.expired). Borra la consulta de una orden que
// expiró sin pagarse, con su anamnesis. Las mediciones tomadas en la consulta NO se borran: quedan
// en la ficha clínica del paciente como mediciones sueltas. Una orden de plan estándar no tiene
// consulta: no hay nada que borrar.
@Injectable()
export class DeleteExpiredConsultationUseCase {
  private readonly logger = new Logger(DeleteExpiredConsultationUseCase.name);

  constructor(
    private readonly nutritionalConsultationRepository: NutritionalConsultationRepository,
  ) {}

  async execute(input: { orderId: string }): Promise<{ deleted: boolean }> {
    const deleted =
      await this.nutritionalConsultationRepository.deleteNutritionalConsultationByOrderId(
        input.orderId,
      );
    if (deleted) {
      this.logger.log(`Orden ${input.orderId}: consulta borrada por expiración`);
    }
    return { deleted };
  }
}
