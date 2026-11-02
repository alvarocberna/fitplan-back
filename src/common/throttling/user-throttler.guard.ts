import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

// Rate limiting por usuario. El frontend llama al backend desde su servidor (Server Actions), así que
// todas las requests llegan desde unas pocas IP: limitar por IP haría que los usuarios compartieran el
// cupo. La clave es el `sub` del access_token; sin token (endpoints públicos, webhook) es la IP.
@Injectable()
export class UserThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, any>): Promise<string> {
    const sub = subjectFromAuthorization(req.headers?.authorization);
    return sub ? `user:${sub}` : `ip:${req.ip ?? 'unknown'}`;
  }
}

// Lee el `sub` del JWT SIN verificar la firma: acá solo se necesita una clave para contar. Si alguien
// inventa un `sub` para evadir el límite, su request igual muere en CognitoAuthGuard con un 401 (y ese
// camino no llama al modelo ni a la base).
export function subjectFromAuthorization(header: unknown): string | null {
  if (typeof header !== 'string' || !header.startsWith('Bearer ')) return null;
  const payload = header.slice('Bearer '.length).split('.')[1];
  if (!payload) return null;
  try {
    const claims: unknown = JSON.parse(
      Buffer.from(payload, 'base64url').toString('utf8'),
    );
    const sub = (claims as { sub?: unknown })?.sub;
    return typeof sub === 'string' && sub.length > 0 && sub.length <= 128
      ? sub
      : null;
  } catch {
    return null;
  }
}
