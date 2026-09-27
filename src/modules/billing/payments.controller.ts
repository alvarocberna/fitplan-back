import {
  Body,
  Controller,
  Param,
  ParseUUIDPipe,
  Post,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { PaymentWebhookDtoImpl } from './dto/payment-webhook.dto';
import {
  ConfirmPaymentResult,
  ConfirmPaymentUseCase,
} from './use-cases/confirm-payment.use-case';
import { PaymentSimulationEnabledGuard } from './payment-simulation-enabled.guard';

// Webhook de la pasarela de pago (server a server, sin sesión de usuario).
@Controller('webhooks')
export class PaymentsWebhookController {
  constructor(private readonly confirmPayment: ConfirmPaymentUseCase) {}

  // Hoy no hay pasarela integrada: ver ConfirmPaymentUseCase.verifyWebhookSignature para el punto
  // donde se conectará la firma real.
  @Post('payments')
  receive(@Body() body: PaymentWebhookDtoImpl): Promise<ConfirmPaymentResult> {
    if (!this.confirmPayment.verifyWebhookSignature()) {
      throw new UnauthorizedException('Firma de webhook inválida');
    }
    return this.confirmPayment.execute({ orderId: body.orderId });
  }
}

// Mientras no exista una pasarela real, este endpoint dispara la misma lógica del webhook para una
// orden dada. Solo responde con ENABLE_PAYMENT_SIMULATION=true (404 en cualquier otro caso).
@UseGuards(PaymentSimulationEnabledGuard)
@Controller('dev/orders')
export class DevPaymentsController {
  constructor(private readonly confirmPayment: ConfirmPaymentUseCase) {}

  @Post(':id/simulate-payment')
  simulate(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<ConfirmPaymentResult> {
    return this.confirmPayment.execute({ orderId: id });
  }
}
