// El proveedor de identidad no respondió o respondió algo inutilizable (red, 5xx, token rechazado).
export class IdentityProviderUnavailableError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'IdentityProviderUnavailableError';
  }
}
