import { Injectable, Logger } from '@nestjs/common';
import { OrdersService } from '../orders/orders.service';
import { PlanGenerationService } from '../plan-generation/plan-generation.service';

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(
    private readonly ordersService: OrdersService,
    private readonly planGenerationService: PlanGenerationService,
  ) {}

  // Punto de extensión aislado para cuando se integre una pasarela real (Mercado Pago, Flow,
  // Stripe, etc.): acá se debe validar la firma/secreto del webhook contra el header que
  // corresponda y devolver false si no coincide. Como todavía no hay pasarela, se acepta siempre.
  verifyWebhookSignature(): boolean {
    return true;
  }

  // Idempotente: si la orden ya estaba en paymentStatus='pagado', no la reprocesa ni vuelve a
  // disparar la generación. La respuesta no espera a que termine la generación (esta corre
  // en segundo plano) para no bloquear al webhook.
  async processPayment(orderId: string): Promise<{ status: 'procesado' | 'ya_procesado' }> {
    //busca la orden, 404 si la orden no existe
    await this.ordersService.findById(orderId);

    //marca el paymentStatus de pendiente -> pagado
    const markedNow = await this.ordersService.markAsPaid(orderId);
    if (!markedNow) {
      this.logger.log(`Orden ${orderId}: webhook de pago recibido pero ya estaba pagada (ignorado)`);
      return { status: 'ya_procesado' };
    }

    // fire-and-forget: el worker maneja sus propios reintentos y estados de error internamente,
    // así que un catch acá es solo una red de seguridad contra errores realmente inesperados.
    this.planGenerationService.generatePlan(orderId).catch((error) => {
      this.logger.error(`Orden ${orderId}: error no controlado al disparar la generación: ${error.message}`);
    });

    return { status: 'procesado' };
  }
}
