// Puerto hacia el canal de alertas operativas (hoy un adaptador que solo deja un log estructurado,
// ver infrastructure/alerts). Lo usan los casos de uso para avisar de algo que requiere intervención
// humana, sin conocer por dónde se entrega el aviso.
export type AlertSeverity = 'warning' | 'critical';

export interface Alert {
  // identificador estable del tipo de alerta, ej. 'plan_generation_failed'
  event: string;
  severity: AlertSeverity;
  message: string;
  context?: Record<string, unknown>;
}

export abstract class AlertNotifier {
  // Nunca debe lanzar: una alerta que no se pudo entregar no puede romper el flujo que la emite.
  abstract notify(alert: Alert): Promise<void>;
}
