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
import {
  RejectPaymentResult,
  RejectPaymentUseCase,
} from './use-cases/reject-payment.use-case';
import { PaymentSimulationEnabledGuard } from './payment-simulation-enabled.guard';
import { PaymentTransactionStatus } from '../../domain/entities/enums';

// Webhook de la pasarela de pago (server a server, sin sesión de usuario).
@Controller('webhooks')
export class PaymentsWebhookController {
  constructor(
    private readonly confirmPayment: ConfirmPaymentUseCase,
    private readonly rejectPayment: RejectPaymentUseCase,
  ) {}

  // Hoy no hay pasarela integrada: ver ConfirmPaymentUseCase.verifyWebhookSignature para el punto
  // donde se conectará la firma real. Un pago rechazado (status REJECTED) va a RejectPaymentUseCase.
  @Post('payments')
  receive(
    @Body() body: PaymentWebhookDtoImpl,
  ): Promise<ConfirmPaymentResult | RejectPaymentResult> {
    if (!this.confirmPayment.verifyWebhookSignature()) {
      throw new UnauthorizedException('Firma de webhook inválida');
    }
    if (body.status === PaymentTransactionStatus.REJECTED) {
      return this.rejectPayment.execute({ orderId: body.orderId });
    }
    return this.confirmPayment.execute({ orderId: body.orderId });
  }
}

// Mientras no exista una pasarela real, estos endpoints disparan la misma lógica del webhook para
// una orden dada (pago autorizado o rechazado). Solo responden con ENABLE_PAYMENT_SIMULATION=true
// (404 en cualquier otro caso).
@UseGuards(PaymentSimulationEnabledGuard)
@Controller('dev/orders')
export class DevPaymentsController {
  constructor(
    private readonly confirmPayment: ConfirmPaymentUseCase,
    private readonly rejectPayment: RejectPaymentUseCase,
  ) {}

  @Post(':id/simulate-payment')
  simulate(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<ConfirmPaymentResult> {
    return this.confirmPayment.execute({ orderId: id });
  }

  @Post(':id/simulate-payment-rejection')
  simulateRejection(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<RejectPaymentResult> {
    return this.rejectPayment.execute({ orderId: id });
  }
}
