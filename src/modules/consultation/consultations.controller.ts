import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { CognitoAuthGuard } from '../../common/auth/cognito-auth.guard';
import { CognitoUser } from '../../common/auth/cognito-user.decorator';
import type { CognitoUserClaims } from '../../common/auth/cognito-user.decorator';
import { InputChatDtoImpl, OutputChatDtoImpl } from './dto/anamnesis-chat.dto';
import { CompleteConsultationDtoImpl } from './dto/consultation.dto';
import { ChatAnamnesisUseCase } from './use-cases/chat-anamnesis.use-case';
import { CreateConsultationUseCase } from './use-cases/create-consultation.use-case';

@UseGuards(CognitoAuthGuard)
@Controller('consultations')
export class ConsultationsController {
  constructor(
    private readonly chatAnamnesis: ChatAnamnesisUseCase,
    private readonly createConsultation: CreateConsultationUseCase,
  ) {}

  // Un turno del chat de anamnesis.
  @Post('chat')
  chat(@Body() body: InputChatDtoImpl): Promise<OutputChatDtoImpl> {
    return this.chatAnamnesis.execute(body);
  }

  // Crea la consulta y su orden pendiente de pago. El frontend navega a la página de pago con el
  // orderId devuelto.
  @Post()
  create(
    @Body() body: CompleteConsultationDtoImpl,
    @CognitoUser() claims: CognitoUserClaims,
  ): Promise<{ orderId: string }> {
    return this.createConsultation.execute({ claims, consultation: body });
  }
}
