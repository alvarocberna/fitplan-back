// Errores del puerto PaymentGateway. Clases planas (sin NestJS): el adaptador traduce a ellas los
// errores del SDK y la capa HTTP decide cómo responderlos.

// La pasarela no respondió o rechazó la llamada: red, timeout, error 4xx/5xx de la pasarela.
export class PaymentGatewayUnavailableError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'PaymentGatewayUnavailableError';
  }
}
