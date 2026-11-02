import {
  Body,
  Controller,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CognitoAuthGuard } from '../../common/auth/cognito-auth.guard';
import { CognitoUser } from '../../common/auth/cognito-user.decorator';
import type { CognitoUserClaims } from '../../common/auth/cognito-user.decorator';
import {
  ORDER_THROTTLE,
  PAYMENT_RETURN_THROTTLE,
} from '../../common/throttling/throttle-limits';
import { CommitWebpayPaymentDtoImpl } from './dto/commit-webpay-payment.dto';
import {
  CommitWebpayPaymentResult,
  CommitWebpayPaymentUseCase,
} from './use-cases/commit-webpay-payment.use-case';
import {
  ConfirmPaymentResult,
  ConfirmPaymentUseCase,
} from './use-cases/confirm-payment.use-case';
import {
  RejectPaymentResult,
  RejectPaymentUseCase,
} from './use-cases/reject-payment.use-case';
import { PaymentSimulationEnabledGuard } from './payment-simulation-enabled.guard';

// Retorno de la pasarela de pago. Lo llama el frontend (server a server) cuando Webpay devuelve al
// usuario; no hay sesión: se identifica por el token de la transacción (ver CommitWebpayPaymentUseCase).
@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly commitWebpayPayment: CommitWebpayPaymentUseCase,
  ) {}

  @Throttle(PAYMENT_RETURN_THROTTLE)
  @HttpCode(200)
  @Post('webpay/commit')
  commitWebpay(
    @Body() body: CommitWebpayPaymentDtoImpl,
  ): Promise<CommitWebpayPaymentResult> {
    return this.commitWebpayPayment.execute(body);
  }
}

// Pago simulado, para desarrollo y pruebas sin pasar por la pasarela: marca la orden como pagada o
// rechazada directamente. Solo responde con ENABLE_PAYMENT_SIMULATION=true (404 en cualquier otro
// caso; en producción va en false) y exige la sesión del dueño de la orden (404 si no, regla R2).
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
