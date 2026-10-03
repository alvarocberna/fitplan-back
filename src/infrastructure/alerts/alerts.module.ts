import { Module } from '@nestjs/common';
import { AlertNotifier } from '../../domain/ports';
import { LogAlertNotifier } from './log-alert-notifier';

@Module({
  providers: [{ provide: AlertNotifier, useClass: LogAlertNotifier }],
  exports: [AlertNotifier],
})
export class AlertsModule {}
