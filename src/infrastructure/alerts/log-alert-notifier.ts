import { Injectable, Logger } from '@nestjs/common';
import { Alert, AlertNotifier } from '../../domain/ports';

// Adaptador provisorio: la alerta queda como un log estructurado (nivel error para 'critical', warn
// para 'warning') con el prefijo ALERT, para poder filtrarla o enganchar una alarma sobre los logs.
// TODO: reemplazar por un adaptador real (correo con Amazon SES, Slack, etc.) cuando se defina el canal.
@Injectable()
export class LogAlertNotifier implements AlertNotifier {
  private readonly logger = new Logger('ALERT');

  notify(alert: Alert): Promise<void> {
    const entry = {
      event: alert.event,
      severity: alert.severity,
      message: alert.message,
      ...alert.context,
    };
    if (alert.severity === 'critical') this.logger.error(entry);
    else this.logger.warn(entry);
    return Promise.resolve();
  }
}
