import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, timingSafeEqual } from 'node:crypto';

export const PAYMENT_WEBHOOK_SECRET_HEADER = 'x-webhook-secret';

// Autenticación del webhook de pagos (server a server, sin sesión de usuario). Mientras no haya una
// pasarela real (Transbank traerá su propia firma) se exige un secreto compartido en un header.
// Falla cerrado: sin PAYMENT_WEBHOOK_SECRET configurado, ninguna llamada es válida.
@Injectable()
export class PaymentWebhookVerifier {
  constructor(private readonly configService: ConfigService) {}

  isValid(headerValue: unknown): boolean {
    const secret = this.configService.get<string>('PAYMENT_WEBHOOK_SECRET');
    if (!secret || typeof headerValue !== 'string' || !headerValue) return false;
    // Se comparan los hashes (mismo largo siempre) en tiempo constante, para no filtrar por tiempo
    // de respuesta ni el largo ni el contenido del secreto.
    const expected = createHash('sha256').update(secret).digest();
    const received = createHash('sha256').update(headerValue).digest();
    return timingSafeEqual(expected, received);
  }
}
