import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { OrderStatusDto } from '../../domain';
import { CognitoAuthGuard } from '../../common/auth/cognito-auth.guard';
import { CognitoUser } from '../../common/auth/cognito-user.decorator';
import type { CognitoUserClaims } from '../../common/auth/cognito-user.decorator';
import { GetOrderStatusUseCase } from './use-cases/get-order-status.use-case';

@UseGuards(CognitoAuthGuard)
@Controller('orders')
export class OrdersController {
  constructor(private readonly getOrderStatus: GetOrderStatusUseCase) {}

  // El frontend hace polling a este endpoint desde la página de la orden (/ordenes/[id]).
  @Get(':id/status')
  status(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CognitoUser() claims: CognitoUserClaims,
  ): Promise<OrderStatusDto> {
    return this.getOrderStatus.execute({ claims, orderId: id });
  }
}
