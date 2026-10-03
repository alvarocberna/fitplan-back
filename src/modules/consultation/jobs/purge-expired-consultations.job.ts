import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PurgeExpiredConsultationsUseCase } from '../use-cases/purge-expired-consultations.use-case';

// Tarea programada (ScheduleModule en AppModule): barrido de las consultas que quedaron sin borrar
// tras expirar su orden. Una vez por hora alcanza: esas consultas ya están ocultas para el usuario.
@Injectable()
export class PurgeExpiredConsultationsJob {
  private readonly logger = new Logger(PurgeExpiredConsultationsJob.name);

  constructor(
    private readonly purgeExpiredConsultations: PurgeExpiredConsultationsUseCase,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async run(): Promise<void> {
    try {
      await this.purgeExpiredConsultations.execute();
    } catch (error) {
      this.logger.error(
        `Error al purgar consultas de órdenes expiradas: ${(error as Error).message}`,
      );
    }
  }
}
