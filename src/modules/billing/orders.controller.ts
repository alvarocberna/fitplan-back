import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { OrderStatusDto } from '../../domain';
import { CognitoAuthGuard } from '../../common/auth/cognito-auth.guard';
import { CognitoUser } from '../../common/auth/cognito-user.decorator';
import type { CognitoUserClaims } from '../../common/auth/cognito-user.decorator';
import { ORDER_THROTTLE } from '../../common/throttling/throttle-limits';
import { GetOrderStatusUseCase } from './use-cases/get-order-status.use-case';
import {
  StartPaymentResult,
  StartPaymentUseCase,
} from './use-cases/start-payment.use-case';

@UseGuards(CognitoAuthGuard)
@Controller('orders')
export class OrdersController {
  constructor(
    private readonly getOrderStatus: GetOrderStatusUseCase,
    private readonly startPayment: StartPaymentUseCase,
  ) {}

  // El frontend hace polling a este endpoint desde la página de la orden (/ordenes/[id]).
  @Get(':id/status')
  status(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CognitoUser() claims: CognitoUserClaims,
  ): Promise<OrderStatusDto> {
    return this.getOrderStatus.execute({ claims, orderId: id });
  }

  // Inicia un pago de la orden en Webpay: responde la URL del formulario y el token a enviarle.
  @Throttle(ORDER_THROTTLE)
  @Post(':id/payments')
  pay(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CognitoUser() claims: CognitoUserClaims,
  ): Promise<StartPaymentResult> {
    return this.startPayment.execute({ claims, orderId: id });
  }
}
