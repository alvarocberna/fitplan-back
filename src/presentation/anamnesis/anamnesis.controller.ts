import { Body, Controller, Post } from '@nestjs/common';
import { AnamnesisService } from './anamnesis.service';
import { AnamnesisChat_RequestDtoImpl, AnamnesisChat_ResponseDtoImpl } from './dto/anamnesis-chat.dto';

@Controller('anamnesis')
export class AnamnesisController {
  constructor(private readonly anamnesisService: AnamnesisService) {}

  @Post('chat')
  chat(@Body() body: AnamnesisChat_RequestDtoImpl): Promise<AnamnesisChat_ResponseDtoImpl> {
    return this.anamnesisService.chat(body);
  }
}
