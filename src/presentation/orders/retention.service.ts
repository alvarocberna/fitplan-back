import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { CronJob } from 'cron';
import { OrdersService } from './orders.service';

// Conserva la fila de la orden (auditoría/estadísticas) pero anula los campos con datos
// de salud (payloadJson, planJson) pasado este período.
const RETENTION_DAYS = 45;

// Job simple de limpieza/retención: corre una vez al día. Si en algún momento se necesita
// correrlo fuera de este proceso (ej. un cron real del SO), basta con invocar
// OrdersService.cleanupOldOrders(RETENTION_DAYS) desde un script.
@Injectable()
export class RetentionService implements OnModuleInit {
  private readonly logger = new Logger(RetentionService.name);

  constructor(private readonly ordersService: OrdersService) {}

  onModuleInit() {
    const job = new CronJob('0 3 * * *', () => this.runCleanup());
    job.start();
    this.logger.log(`Job de retención programado (diario 03:00, retención de ${RETENTION_DAYS} días)`);
  }

  private async runCleanup(): Promise<void> {
    try {
      await this.ordersService.cleanupOldOrders(RETENTION_DAYS);
    } catch (error) {
      this.logger.error(`Falló la limpieza de retención: ${(error as Error).message}`);
    }
  }
}
