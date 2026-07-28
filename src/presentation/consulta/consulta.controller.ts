import { Body, Controller, Post } from '@nestjs/common';
import { ConsultaService } from './consulta.service';
import { InputChatDtoImpl, OutputChatDtoImpl } from './dto/anamnesis-chat.dto';

@Controller('consulta')
export class ConsultaController {
  constructor(private readonly consultaService: ConsultaService) {}

  @Post('chat')
  chat(@Body() body: InputChatDtoImpl): Promise<OutputChatDtoImpl> {
    return this.consultaService.chat(body);
  }
}
