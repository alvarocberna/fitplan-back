import { Body, Controller, Param, ParseUUIDPipe, Post, UnauthorizedException } from '@nestjs/common';
import { WebhooksService } from './webhooks.service';
import { WebhookPagoDtoImpl } from './dto/webhook-pago.dto';

@Controller('webhooks')
export class WebhooksController {
  constructor(private readonly webhooksService: WebhooksService) {}

  //handler real del webhook de la pasarela de pago (hoy no hay pasarela integrada:
  //ver WebhooksService.verifyWebhookSignature para el punto donde se conectará la firma real).
  @Post('pago')
  receivePaymentWebhook(@Body() body: WebhookPagoDtoImpl) {
    if (!this.webhooksService.verifyWebhookSignature()) {
      throw new UnauthorizedException('Firma de webhook inválida');
    }
    return this.webhooksService.processPayment(body.orden_id);
  }

  //PARA PRUEBAS: mientras no exista una pasarela de pago real, este endpoint permite
  //disparar manualmente la misma lógica del webhook de pago para una orden dada.
  @Post('ordenes/:id/simular-pago')
  simulatePayment(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.webhooksService.processPayment(id);
  }
}
