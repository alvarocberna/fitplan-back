import { Body, Controller, Post } from '@nestjs/common';
import { PlanNutricionalDto } from '../../domain/dtos/plan-nutricional.dto';
import { ConsultaService } from './consulta.service';
import { ConsultaCompletaDtoImpl } from './dto/consulta-completa.dto';

@Controller('consulta')
export class ConsultaController {
  constructor(private readonly consultaService: ConsultaService) {}

  @Post('procesar')
  procesar(@Body() body: ConsultaCompletaDtoImpl): Promise<PlanNutricionalDto> {
    return this.consultaService.procesar(body);
  }
}
