import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { RetryPendingGenerationsUseCase } from '../use-cases/retry-pending-generations.use-case';

// Tarea programada (ScheduleModule en AppModule): relanza periódicamente la generación de los planes
// pagados que fallaron o quedaron interrumpidos.
@Injectable()
export class RetryPendingGenerationsJob {
  private readonly logger = new Logger(RetryPendingGenerationsJob.name);
  // una corrida puede durar más que el intervalo del cron (genera planes): no se solapan.
  private running = false;

  constructor(
    private readonly retryPendingGenerations: RetryPendingGenerationsUseCase,
  ) {}

  @Cron(CronExpression.EVERY_10_MINUTES)
  async run(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      await this.retryPendingGenerations.execute();
    } catch (error) {
      this.logger.error(
        `Error al reintentar generaciones pendientes: ${(error as Error).message}`,
        (error as Error).stack,
      );
    } finally {
      this.running = false;
    }
  }
}
