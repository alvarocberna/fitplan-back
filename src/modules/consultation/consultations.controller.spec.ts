import { Test, TestingModule } from '@nestjs/testing';
import { ConsultationsController } from './consultations.controller';
import { ChatAnamnesisUseCase } from './use-cases/chat-anamnesis.use-case';
import { CreateConsultationUseCase } from './use-cases/create-consultation.use-case';
import { EvaluateGoalFeasibilityUseCase } from './use-cases/evaluate-goal-feasibility.use-case';
import { GoalFeasibilityRequestDtoImpl } from './dto/goal-feasibility.dto';
import { InputChatDtoImpl, OutputChatDtoImpl } from './dto/anamnesis-chat.dto';
import { CompleteConsultationDtoImpl } from './dto/consultation.dto';
import type { CognitoUserClaims } from '../../common/auth/cognito-user.decorator';

describe('ConsultationsController', () => {
  let controller: ConsultationsController;
  let chatAnamnesis: { execute: jest.Mock };
  let createConsultation: { execute: jest.Mock };
  let evaluateGoalFeasibility: { execute: jest.Mock };

  beforeEach(async () => {
    chatAnamnesis = { execute: jest.fn() };
    createConsultation = { execute: jest.fn() };
    evaluateGoalFeasibility = { execute: jest.fn() };
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ConsultationsController],
      providers: [
        { provide: ChatAnamnesisUseCase, useValue: chatAnamnesis },
        { provide: CreateConsultationUseCase, useValue: createConsultation },
        { provide: EvaluateGoalFeasibilityUseCase, useValue: evaluateGoalFeasibility },
      ],
    }).compile();

    controller = module.get(ConsultationsController);
  });

  it('chat() delega en ChatAnamnesisUseCase y devuelve su resultado', async () => {
    const body = { messages: [{ role: 'user', content: 'hola' }], anamnesis: null } as unknown as InputChatDtoImpl;
    const output = { reply: 'hola!', titleReply: 'Inicio', anamnesis: null, isComplete: false } as unknown as OutputChatDtoImpl;
    chatAnamnesis.execute.mockResolvedValue(output);

    await expect(controller.chat(body)).resolves.toBe(output);
    expect(chatAnamnesis.execute).toHaveBeenCalledWith(body);
  });

  it('create() delega en CreateConsultationUseCase con los claims y el body', async () => {
    const body = { personalInfo: { email: 'a@b.com' } } as unknown as CompleteConsultationDtoImpl;
    const claims: CognitoUserClaims = { sub: 'test-sub' };
    createConsultation.execute.mockResolvedValue({ orderId: 'order-1' });

    await expect(controller.create(body, claims)).resolves.toEqual({ orderId: 'order-1' });
    expect(createConsultation.execute).toHaveBeenCalledWith({ claims, consultation: body });
  });

  it('goalFeasibility() delega en EvaluateGoalFeasibilityUseCase con los claims, goals y measurements', async () => {
    const body = {
      goals: { primaryGoal: 'bajar de peso', secondaryGoal: null },
      measurements: { weight: 55, height: 170 },
    } as unknown as GoalFeasibilityRequestDtoImpl;
    const claims: CognitoUserClaims = { sub: 'test-sub' };
    const output = { feasible: false, goal: 'definicion', message: 'peso bajo' };
    evaluateGoalFeasibility.execute.mockResolvedValue(output);

    await expect(controller.goalFeasibility(body, claims)).resolves.toBe(output);
    expect(evaluateGoalFeasibility.execute).toHaveBeenCalledWith({
      claims,
      goals: body.goals,
      measurements: body.measurements,
    });
  });
});
