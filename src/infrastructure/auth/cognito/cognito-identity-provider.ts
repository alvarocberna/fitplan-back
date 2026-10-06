import { Injectable } from '@nestjs/common';
import { IdentityProvider, ProviderIdentity } from '../../../domain/ports';
import { IdentityProviderUnavailableError } from '../../../domain/errors/identity.errors';

const REQUEST_TIMEOUT_MS = 10_000;

interface UserInfoResponse {
  sub?: unknown;
  email?: unknown;
  email_verified?: unknown;
  username?: unknown;
}

// Consulta el endpoint userInfo de Cognito con el access_token del propio usuario. Es la fuente del
// email de la cuenta: el backend nunca confía en un email enviado por el cliente (permitiría ligar la
// identidad de un atacante al User de otra persona).
@Injectable()
export class CognitoIdentityProvider implements IdentityProvider {
  private userInfoEndpoint: Promise<string> | null = null;

  async getIdentity(accessToken: string): Promise<ProviderIdentity> {
    const endpoint = await this.getUserInfoEndpoint();
    const body = await this.fetchJson<UserInfoResponse>(endpoint, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (typeof body.sub !== 'string') {
      throw new IdentityProviderUnavailableError('Cognito userInfo respondió sin "sub"');
    }
    const email =
      typeof body.email === 'string' && body.email ? body.email.toLowerCase() : null;
    return {
      sub: body.sub,
      email,
      emailVerified: this.isEmailVerified(body),
    };
  }

  // Cognito entrega email_verified como booleano o como el string "true". Para una cuenta federada
  // de Google el atributo no siempre viene mapeado: Google solo entrega correos que ya verificó, así
  // que esa identidad (username "google_<id>") se da por verificada.
  private isEmailVerified(body: UserInfoResponse): boolean {
    if (body.email_verified === true || body.email_verified === 'true') return true;
    return typeof body.username === 'string' && /^google_/i.test(body.username);
  }

  // El endpoint sale del documento de discovery del User Pool (no hace falta una variable más). Se
  // cachea; si el discovery falla se reintenta en la siguiente llamada.
  private getUserInfoEndpoint(): Promise<string> {
    if (!this.userInfoEndpoint) {
      this.userInfoEndpoint = this.discoverUserInfoEndpoint().catch((error) => {
        this.userInfoEndpoint = null;
        throw error;
      });
    }
    return this.userInfoEndpoint;
  }

  private async discoverUserInfoEndpoint(): Promise<string> {
    const userPoolId = process.env.COGNITO_USER_POOL_ID;
    if (!userPoolId) {
      throw new IdentityProviderUnavailableError(
        'Falta la variable de entorno COGNITO_USER_POOL_ID',
      );
    }
    const region = userPoolId.split('_')[0];
    const discovery = await this.fetchJson<{ userinfo_endpoint?: unknown }>(
      `https://cognito-idp.${region}.amazonaws.com/${userPoolId}/.well-known/openid-configuration`,
    );
    if (typeof discovery.userinfo_endpoint !== 'string') {
      throw new IdentityProviderUnavailableError(
        'El discovery de Cognito no trae userinfo_endpoint',
      );
    }
    return discovery.userinfo_endpoint;
  }

  private async fetchJson<T>(url: string, init: RequestInit = {}): Promise<T> {
    let response: Response;
    try {
      response = await fetch(url, {
        ...init,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (error) {
      throw new IdentityProviderUnavailableError(
        `No se pudo contactar a Cognito: ${(error as Error).message}`,
        error,
      );
    }
    if (!response.ok) {
      throw new IdentityProviderUnavailableError(`Cognito respondió HTTP ${response.status}`);
    }
    try {
      return (await response.json()) as T;
    } catch {
      throw new IdentityProviderUnavailableError('Cognito respondió algo que no es JSON');
    }
  }
}
