import { Test, TestingModule } from '@nestjs/testing';
import { ConsultationController } from './consultation.controller';
import { ConsultationService } from './consultation.service';
import { InputChatDtoImpl, OutputChatDtoImpl } from './dto/anamnesis-chat.dto';

describe('ConsultationController', () => {
  let controller: ConsultationController;
  let service: jest.Mocked<ConsultationService>;

  beforeEach(async () => {
    // El scaffolding original de Nest CLI proveía ConsultationService "a secas", sin mockear su
    // dependencia OpenaiService: solo funcionaba porque nunca se ejecutaba código real. Acá se
    // mockea ConsultationService directamente (lo único que el controller realmente usa).
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ConsultationController],
      providers: [{ provide: ConsultationService, useValue: { chat: jest.fn() } }],
    }).compile();

    controller = module.get(ConsultationController);
    service = module.get(ConsultationService);
  });

  it('está definido', () => {
    expect(controller).toBeDefined();
  });

  it('chat() delega en ConsultationService.chat y devuelve su resultado', async () => {
    const body = { messages: [{ role: 'user', content: 'hola' }], anamnesis: null } as unknown as InputChatDtoImpl;
    const output = { reply: 'hola!', titleReply: 'Inicio', anamnesis: null, isComplete: false } as unknown as OutputChatDtoImpl;
    service.chat.mockResolvedValue(output);

    await expect(controller.chat(body)).resolves.toBe(output);
    expect(service.chat).toHaveBeenCalledWith(body);
  });
});
