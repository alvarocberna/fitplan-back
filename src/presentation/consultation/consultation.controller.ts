import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ConsultationService } from './consultation.service';
import { InputChatDtoImpl, OutputChatDtoImpl } from './dto/anamnesis-chat.dto';
import { CognitoAuthGuard } from '../auth/cognito-auth.guard';

@Controller('consulta')
export class ConsultationController {
  constructor(private readonly consultationService: ConsultationService) {}

  @UseGuards(CognitoAuthGuard)
  @Post('chat')
  chat(@Body() body: InputChatDtoImpl): Promise<OutputChatDtoImpl> {
    return this.consultationService.chat(body);
  }
}
