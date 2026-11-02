import { CanActivate, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

// El simulador de pagos es hoy el único camino de pago (no hay pasarela real), así que no se ata a
// NODE_ENV: se habilita explícitamente por entorno. Deshabilitado responde 404, como si la ruta no
// existiera.
@Injectable()
export class PaymentSimulationEnabledGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(): boolean {
    if (
      this.configService.get<string>('ENABLE_PAYMENT_SIMULATION') !== 'true'
    ) {
      throw new NotFoundException();
    }
    return true;
  }
}
