// Errores del puerto LlmProvider. Son clases planas (sin NestJS): el adaptador traduce a ellas los
// errores del SDK y la capa HTTP decide cómo responderlos.

// El proveedor no respondió: red, timeout, rate limit o error 5xx del proveedor.
export class LlmUnavailableError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'LlmUnavailableError';
  }
}

// El proveedor respondió, pero con algo que no se puede usar (vacío o que no es JSON).
export class LlmInvalidResponseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LlmInvalidResponseError';
  }
}
