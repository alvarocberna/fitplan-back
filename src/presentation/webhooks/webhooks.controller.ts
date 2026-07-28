import { Body, Controller, Param, ParseUUIDPipe, Post, UnauthorizedException } from '@nestjs/common';
import { WebhooksService } from './webhooks.service';
import { WebhookPagoDtoImpl } from './dto/webhook-pago.dto';

@Controller('webhooks')
export class WebhooksController {
  constructor(private readonly webhooksService: WebhooksService) {}

  //handler real del webhook de la pasarela de pago (hoy no hay pasarela integrada:
  //ver WebhooksService.verificarFirmaWebhook para el punto donde se conectará la firma real).
  @Post('pago')
  recibirWebhookPago(@Body() body: WebhookPagoDtoImpl) {
    if (!this.webhooksService.verificarFirmaWebhook()) {
      throw new UnauthorizedException('Firma de webhook inválida');
    }
    return this.webhooksService.procesarPago(body.orden_id);
  }

  //PARA PRUEBAS: mientras no exista una pasarela de pago real, este endpoint permite
  //disparar manualmente la misma lógica del webhook de pago para una orden dada.
  @Post('ordenes/:id/simular-pago')
  simularPago(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.webhooksService.procesarPago(id);
  }
}
