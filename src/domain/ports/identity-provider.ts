// Puerto hacia el proveedor de identidad (Cognito). El access_token solo trae el `sub`: para conocer
// el email de la cuenta hay que preguntárselo al proveedor, nunca aceptarlo de lo que mande el cliente.
export interface ProviderIdentity {
  sub: string;
  email: string | null;
  // true solo si el proveedor confirma que la persona controla ese correo
  emailVerified: boolean;
}

export abstract class IdentityProvider {
  // Lanza IdentityProviderUnavailableError si no se pudo consultar al proveedor.
  abstract getIdentity(accessToken: string): Promise<ProviderIdentity>;
}
