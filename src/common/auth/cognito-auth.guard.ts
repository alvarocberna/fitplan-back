import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { FetchError, JwksValidationError, JwtBaseError } from 'aws-jwt-verify/error';
import { getCognitoVerifier } from '../../infrastructure/auth/cognito/cognito-verifier';
import { ErrorCode } from '../errors/error-codes';

@Injectable()
export class CognitoAuthGuard implements CanActivate {
  private readonly logger = new Logger(CognitoAuthGuard.name);

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers['authorization'];
    const token =
      typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
        ? authHeader.slice('Bearer '.length)
        : null;

    if (!token) throw new UnauthorizedException('Falta el token de autenticación');

    // Fuera del try: una configuración faltante es un error del servidor (500), no un token inválido.
    const verifier = getCognitoVerifier();

    try {
      const payload = await verifier.verify(token);
      request.cognitoUser = { sub: payload.sub };
      return true;
    } catch (error) {
      // Solo un token que no pasa la verificación es un 401. No poder obtener las claves públicas de
      // Cognito (red, JWKS inválido) o cualquier otro fallo es un problema del servicio: se registra
      // y se responde 503, para que el cliente no lo confunda con una sesión vencida.
      if (this.isInvalidTokenError(error)) {
        throw new UnauthorizedException('Token inválido o expirado');
      }
      const cause = error as Error;
      this.logger.error(
        `No se pudo verificar el token contra Cognito: ${cause?.message}`,
        cause?.stack,
      );
      throw new ServiceUnavailableException({
        code: ErrorCode.AUTH_UNAVAILABLE,
        message:
          'No pudimos verificar tu sesión en este momento. Intenta nuevamente en unos minutos.',
      });
    }
  }

  private isInvalidTokenError(error: unknown): boolean {
    return (
      error instanceof JwtBaseError &&
      !(error instanceof FetchError) &&
      !(error instanceof JwksValidationError)
    );
  }
}
