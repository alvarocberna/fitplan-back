import { Body, Controller, Post } from '@nestjs/common';
import { ConsultationService } from './consultation.service';
import { InputChatDtoImpl, OutputChatDtoImpl } from './dto/anamnesis-chat.dto';

@Controller('consulta')
export class ConsultationController {
  constructor(private readonly consultationService: ConsultationService) {}

  @Post('chat')
  chat(@Body() body: InputChatDtoImpl): Promise<OutputChatDtoImpl> {
    return this.consultationService.chat(body);
  }
}
