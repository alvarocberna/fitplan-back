import { Body, Controller, Post } from '@nestjs/common';
import { AnamnesisService } from './anamnesis.service';
import { InputChatDtoImpl, OutputChatDtoImpl } from './dto/anamnesis-chat.dto';

@Controller('anamnesis')
export class AnamnesisController {
  constructor(private readonly anamnesisService: AnamnesisService) {}

  @Post('chat')
  chat(@Body() body: InputChatDtoImpl): Promise<OutputChatDtoImpl> {
    return this.anamnesisService.chat(body);
  }
}
