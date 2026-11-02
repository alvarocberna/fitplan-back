import { Test, TestingModule } from '@nestjs/testing';
import { LogEmailSender } from './log-email-sender';
import { NutritionPlanDto } from '../../domain';

describe('LogEmailSender', () => {
  let service: LogEmailSender;
  let logSpy: jest.SpyInstance;

  const plan = {
    personalInfo: {
      name: 'Ana',
      lastName: 'Pérez',
      age: '30',
      date: '2026-09-06',
    },
  } as unknown as NutritionPlanDto;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [LogEmailSender],
    }).compile();

    service = module.get(LogEmailSender);
    logSpy = jest
      .spyOn((service as any).logger, 'log')
      .mockImplementation(() => undefined);
  });

  it('"envía" el correo (stub) con el adjunto ya generado, sin regenerar el PDF', async () => {
    const buffer = Buffer.from('contenido-pdf');

    await service.sendPlanByEmail('ana@example.com', plan, buffer);

    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('correo simulado enviado a ana@example.com'),
    );
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('plan-nutricional-Ana-Pérez.pdf'),
    );
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining(`${buffer.length} bytes`),
    );
  });
});
