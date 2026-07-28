import { Injectable, Logger } from '@nestjs/common';
import { OrdenesService } from '../ordenes/ordenes.service';
import { GeneracionPlanService } from '../generacion-plan/generacion-plan.service';

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(
    private readonly ordenesService: OrdenesService,
    private readonly generacionPlanService: GeneracionPlanService,
  ) {}

  // Punto de extensión aislado para cuando se integre una pasarela real (Mercado Pago, Flow,
  // Stripe, etc.): acá se debe validar la firma/secreto del webhook contra el header que
  // corresponda y devolver false si no coincide. Como todavía no hay pasarela, se acepta siempre.
  verificarFirmaWebhook(): boolean {
    return true;
  }

  // Idempotente: si la orden ya estaba en estado_pago='pagado', no la reprocesa ni vuelve a
  // disparar la generación. La respuesta no espera a que termine la generación (esta corre
  // en segundo plano) para no bloquear al webhook.
  async procesarPago(ordenId: string): Promise<{ estado: 'procesado' | 'ya_procesado' }> {
    //busca la orden, 404 si la orden no existe
    await this.ordenesService.buscarPorId(ordenId);

    //marca el estado_pago de pendiente -> pagado
    const marcadaAhora = await this.ordenesService.marcarPagada(ordenId);
    if (!marcadaAhora) {
      this.logger.log(`Orden ${ordenId}: webhook de pago recibido pero ya estaba pagada (ignorado)`);
      return { estado: 'ya_procesado' };
    }

    // fire-and-forget: el worker maneja sus propios reintentos y estados de error internamente,
    // así que un catch acá es solo una red de seguridad contra errores realmente inesperados.
    this.generacionPlanService.generarPlan(ordenId).catch((error) => {
      this.logger.error(`Orden ${ordenId}: error no controlado al disparar la generación: ${error.message}`);
    });

    return { estado: 'procesado' };
  }
}
