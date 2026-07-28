//nest
import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
//domain
import { OrdenEstadoDto } from '../../domain';
//presentation - ordenes
import { OrdenesService } from './ordenes.service';
//presentation - consulta
import { ConsultaCompletaDtoImpl } from '../consulta/dto/consulta-completa.dto';

@Controller('ordenes')
export class OrdenesController {
  constructor(private readonly ordenesService: OrdenesService) {}

  //crea la orden (estado_pago='pendiente') ANTES de que el usuario pague.
  @Post('crear')
  crear(@Body() body: ConsultaCompletaDtoImpl): Promise<{ orden_id: string }> {
    return this.ordenesService.crearOrden(body);
  }

  //el frontend hace polling a este endpoint desde /consulta/resultado
  @Get('obtener-estado/:id')
  obtenerEstado(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string): Promise<OrdenEstadoDto> {
    return this.ordenesService.obtenerEstado(id);
  }
}
