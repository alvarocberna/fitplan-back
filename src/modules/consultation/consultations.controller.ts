import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  LLM_THROTTLE,
  ORDER_THROTTLE,
} from '../../common/throttling/throttle-limits';
import { CognitoAuthGuard } from '../../common/auth/cognito-auth.guard';
import { CognitoUser } from '../../common/auth/cognito-user.decorator';
import type { CognitoUserClaims } from '../../common/auth/cognito-user.decorator';
import { InputChatDtoImpl, OutputChatDtoImpl } from './dto/anamnesis-chat.dto';
import { CompleteConsultationDtoImpl } from './dto/consultation.dto';
import { ChatAnamnesisUseCase } from './use-cases/chat-anamnesis.use-case';
import { CreateConsultationUseCase } from './use-cases/create-consultation.use-case';
import { EvaluateGoalFeasibilityUseCase } from './use-cases/evaluate-goal-feasibility.use-case';
import {
  GoalFeasibilityRequestDtoImpl,
  GoalFeasibilityResponseDtoImpl,
} from './dto/goal-feasibility.dto';

@UseGuards(CognitoAuthGuard)
@Controller('consultations')
export class ConsultationsController {
  constructor(
    private readonly chatAnamnesis: ChatAnamnesisUseCase,
    private readonly createConsultation: CreateConsultationUseCase,
    private readonly evaluateGoalFeasibility: EvaluateGoalFeasibilityUseCase,
  ) {}

  // Un turno del chat de anamnesis.
  @Throttle(LLM_THROTTLE)
  @Post('chat')
  chat(@Body() body: InputChatDtoImpl): Promise<OutputChatDtoImpl> {
    return this.chatAnamnesis.execute(body);
  }

  // Evalúa si el objetivo es alcanzable según el estado nutricional (al terminar la evaluación
  // física). Siempre 200: `feasible` indica el resultado.
  @Throttle(LLM_THROTTLE)
  @Post('goal-feasibility')
  @HttpCode(200)
  goalFeasibility(
    @Body() body: GoalFeasibilityRequestDtoImpl,
    @CognitoUser() claims: CognitoUserClaims,
  ): Promise<GoalFeasibilityResponseDtoImpl> {
    return this.evaluateGoalFeasibility.execute({
      claims,
      goals: body.goals ?? null,
      measurements: body.measurements,
    });
  }

  // Crea la consulta y su orden pendiente de pago. El frontend navega a la página de pago con el
  // orderId devuelto.
  @Throttle(ORDER_THROTTLE)
  @Post()
  create(
    @Body() body: CompleteConsultationDtoImpl,
    @CognitoUser() claims: CognitoUserClaims,
  ): Promise<{ orderId: string }> {
    return this.createConsultation.execute({ claims, consultation: body });
  }
}
