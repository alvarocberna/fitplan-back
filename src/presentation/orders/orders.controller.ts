//nest
import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
//domain
import { OrderStatusDto } from '../../domain';
//presentation - orders
import { OrdersService } from './orders.service';
//presentation - consultation
import { CompleteConsultationDtoImpl } from '../consultation/dto/consultation.dto';

@Controller('ordenes')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  //crea la orden (paymentStatus='pendiente') ANTES de que el usuario pague.
  @Post('crear')
  create(@Body() body: CompleteConsultationDtoImpl): Promise<{ orderId: string }> {
    return this.ordersService.createOrder(body);
  }

  //el frontend hace polling a este endpoint desde /consulta/resultado
  @Get('obtener-estado/:id')
  getStatus(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string): Promise<OrderStatusDto> {
    return this.ordersService.getStatus(id);
  }
}
