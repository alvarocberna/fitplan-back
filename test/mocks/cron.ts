// Stub de Jest para 'cron' (ver moduleNameMapper en test/jest-e2e.json). El e2e levanta la
// app real completa, lo que dispara RetentionService.onModuleInit() (ver
// src/presentation/orders/retention.service.ts): sin este stub, quedaría programado un CronJob
// real (disparo diario a las 03:00) que Jest nunca puede cerrar, dejando un handle abierto y
// forzando un exit sucio del proceso de test.
export class CronJob {
  constructor(
    private readonly cronTime: string,
    private readonly onTick: () => void,
  ) {}

  start(): void {}
  stop(): void {}
}
