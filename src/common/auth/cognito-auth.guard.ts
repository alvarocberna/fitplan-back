import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { getCognitoVerifier } from '../../infrastructure/auth/cognito/cognito-verifier';

@Injectable()
export class CognitoAuthGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers['authorization'];
    const token =
      typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
        ? authHeader.slice('Bearer '.length)
        : null;

    if (!token) throw new UnauthorizedException('Falta el token de autenticación');

    try {
      const payload = await getCognitoVerifier().verify(token);
      request.cognitoUser = { sub: payload.sub };
      return true;
    } catch {
      throw new UnauthorizedException('Token inválido o expirado');
    }
  }
}
