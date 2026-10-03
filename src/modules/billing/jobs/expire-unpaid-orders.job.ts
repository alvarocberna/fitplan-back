import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ExpireUnpaidOrdersUseCase } from '../use-cases/expire-unpaid-orders.use-case';

// Tarea programada (ScheduleModule en AppModule): nadie llama a un endpoint cuando una orden se
// abandona, así que es el backend el que revisa periódicamente qué órdenes vencieron.
@Injectable()
export class ExpireUnpaidOrdersJob {
  private readonly logger = new Logger(ExpireUnpaidOrdersJob.name);

  constructor(private readonly expireUnpaidOrders: ExpireUnpaidOrdersUseCase) {}

  @Cron(CronExpression.EVERY_10_MINUTES)
  async run(): Promise<void> {
    try {
      await this.expireUnpaidOrders.execute();
    } catch (error) {
      this.logger.error(
        `Error al expirar órdenes sin pagar: ${(error as Error).message}`,
      );
    }
  }
}
