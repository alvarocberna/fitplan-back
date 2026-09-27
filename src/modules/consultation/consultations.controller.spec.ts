import { Test, TestingModule } from '@nestjs/testing';
import { ConsultationsController } from './consultations.controller';
import { ChatAnamnesisUseCase } from './use-cases/chat-anamnesis.use-case';
import { CreateConsultationUseCase } from './use-cases/create-consultation.use-case';
import { InputChatDtoImpl, OutputChatDtoImpl } from './dto/anamnesis-chat.dto';
import { CompleteConsultationDtoImpl } from './dto/consultation.dto';
import type { CognitoUserClaims } from '../../common/auth/cognito-user.decorator';

describe('ConsultationsController', () => {
  let controller: ConsultationsController;
  let chatAnamnesis: { execute: jest.Mock };
  let createConsultation: { execute: jest.Mock };

  beforeEach(async () => {
    chatAnamnesis = { execute: jest.fn() };
    createConsultation = { execute: jest.fn() };
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ConsultationsController],
      providers: [
        { provide: ChatAnamnesisUseCase, useValue: chatAnamnesis },
        { provide: CreateConsultationUseCase, useValue: createConsultation },
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
});
