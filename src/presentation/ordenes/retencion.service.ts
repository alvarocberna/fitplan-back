import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { CronJob } from 'cron';
import { OrdenesService } from './ordenes.service';

// Conserva la fila de la orden (auditoría/estadísticas) pero anula los campos con datos
// de salud (payload_json, plan_json) pasado este período.
const DIAS_RETENCION = 45;

// Job simple de limpieza/retención: corre una vez al día. Si en algún momento se necesita
// correrlo fuera de este proceso (ej. un cron real del SO), basta con invocar
// OrdenesService.limpiarOrdenesAntiguas(DIAS_RETENCION) desde un script.
@Injectable()
export class RetencionService implements OnModuleInit {
  private readonly logger = new Logger(RetencionService.name);

  constructor(private readonly ordenesService: OrdenesService) {}

  onModuleInit() {
    const job = new CronJob('0 3 * * *', () => this.ejecutarLimpieza());
    job.start();
    this.logger.log(`Job de retención programado (diario 03:00, retención de ${DIAS_RETENCION} días)`);
  }

  private async ejecutarLimpieza(): Promise<void> {
    try {
      await this.ordenesService.limpiarOrdenesAntiguas(DIAS_RETENCION);
    } catch (error) {
      this.logger.error(`Falló la limpieza de retención: ${(error as Error).message}`);
    }
  }
}
