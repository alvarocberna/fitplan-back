import { GenerationStatus } from '../../entities/enums';
import type { OrderEntity } from '../../entities/order.entity';

const MINUTE_MS = 60 * 1000;

// Espera antes de cada ronda de reintento automático de la generación del plan, contada desde el
// fallo de la ronda anterior: el reintento 1 espera 15 min, el 2 espera 1 h y el 3 espera 4 h.
export const GENERATION_RETRY_DELAYS_MS = [
  15 * MINUTE_MS,
  60 * MINUTE_MS,
  4 * 60 * MINUTE_MS,
];

// Rondas totales: la que dispara el pago más los reintentos automáticos. Con order.attempts (rondas
// fallidas) en este valor, el ERROR es definitivo y requiere intervención manual.
export const MAX_GENERATION_ROUNDS = GENERATION_RETRY_DELAYS_MS.length + 1;

// Una orden que lleva más de esto en GENERATING se da por interrumpida (el proceso se reinició a
// mitad de la generación). Holgado respecto de una ronda normal, que tarda unos pocos minutos.
export const STALLED_GENERATION_MS = 30 * MINUTE_MS;

// Una orden pagada que sigue en NOT_STARTED pasado este margen perdió su disparo (order.paid es un
// evento en memoria: no sobrevive a un reinicio del proceso).
export const UNSTARTED_GENERATION_GRACE_MS = 5 * MINUTE_MS;

// ¿La generación falló pero todavía le quedan reintentos automáticos? Para el usuario esa orden
// sigue "generándose": el error solo se le muestra cuando es definitivo.
export function isGenerationRetryPending(
  order: Pick<OrderEntity, 'generationStatus' | 'attempts'>,
): boolean {
  return (
    order.generationStatus === GenerationStatus.ERROR &&
    order.attempts < MAX_GENERATION_ROUNDS
  );
}
