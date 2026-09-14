//nest
import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
//domain
import { OrderStatusDto } from '../../domain';
//presentation - orders
import { OrdersService } from './orders.service';
//presentation - consultation
import { CompleteConsultationDtoImpl } from '../consultation/dto/consultation.dto';
//presentation - auth
import { CognitoAuthGuard } from '../auth/cognito-auth.guard';
import { CognitoUser } from '../auth/cognito-user.decorator';
import type { CognitoUserClaims } from '../auth/cognito-user.decorator';

@Controller('ordenes')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  //crea la orden (paymentStatus='pendiente') ANTES de que el usuario pague.
  @UseGuards(CognitoAuthGuard)
  @Post('crear')
  create(
    @Body() body: CompleteConsultationDtoImpl,
    @CognitoUser() cognitoUser: CognitoUserClaims,
  ): Promise<{ orderId: string }> {
    return this.ordersService.createOrder(body, cognitoUser);
  }

  //el frontend hace polling a este endpoint desde /consulta/resultado
  @Get('obtener-estado/:id')
  getStatus(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string): Promise<OrderStatusDto> {
    return this.ordersService.getStatus(id);
  }
}
