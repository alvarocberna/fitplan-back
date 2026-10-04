import {
  Body,
  Controller,
  Headers,
  Param,
  ParseUUIDPipe,
  Post,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CognitoAuthGuard } from '../../common/auth/cognito-auth.guard';
import { CognitoUser } from '../../common/auth/cognito-user.decorator';
import type { CognitoUserClaims } from '../../common/auth/cognito-user.decorator';
import {
  ORDER_THROTTLE,
  WEBHOOK_THROTTLE,
} from '../../common/throttling/throttle-limits';
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
import {
  PAYMENT_WEBHOOK_SECRET_HEADER,
  PaymentWebhookVerifier,
} from './payment-webhook-verifier';
import { PaymentTransactionStatus } from '../../domain/entities/enums';

// Webhook de la pasarela de pago (server a server, sin sesión de usuario).
@Controller('webhooks')
export class PaymentsWebhookController {
  constructor(
    private readonly confirmPayment: ConfirmPaymentUseCase,
    private readonly rejectPayment: RejectPaymentUseCase,
    private readonly webhookVerifier: PaymentWebhookVerifier,
  ) {}

  // No hay sesión de usuario: el llamador se autentica con el secreto compartido del header
  // x-webhook-secret (PaymentWebhookVerifier; se reemplazará por la firma de la pasarela real). Sin
  // esa verificación cualquiera podría marcar una orden como pagada. Un pago rechazado (status
  // REJECTED) va a RejectPaymentUseCase.
  @Throttle(WEBHOOK_THROTTLE)
  @Post('payments')
  receive(
    @Body() body: PaymentWebhookDtoImpl,
    @Headers(PAYMENT_WEBHOOK_SECRET_HEADER) secret?: string,
  ): Promise<ConfirmPaymentResult | RejectPaymentResult> {
    if (!this.webhookVerifier.isValid(secret)) {
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
// (404 en cualquier otro caso) y, como son el camino de pago del usuario, exigen su sesión y que la
// orden sea suya (404 si no, regla R2): nadie puede pagar ni rechazar la orden de otro.
@UseGuards(PaymentSimulationEnabledGuard, CognitoAuthGuard)
@Throttle(ORDER_THROTTLE)
@Controller('dev/orders')
export class DevPaymentsController {
  constructor(
    private readonly confirmPayment: ConfirmPaymentUseCase,
    private readonly rejectPayment: RejectPaymentUseCase,
  ) {}

  @Post(':id/simulate-payment')
  simulate(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CognitoUser() claims: CognitoUserClaims,
  ): Promise<ConfirmPaymentResult> {
    return this.confirmPayment.execute({ orderId: id, claims });
  }

  @Post(':id/simulate-payment-rejection')
  simulateRejection(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CognitoUser() claims: CognitoUserClaims,
  ): Promise<RejectPaymentResult> {
    return this.rejectPayment.execute({ orderId: id, claims });
  }
}
