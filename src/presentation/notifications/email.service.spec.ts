import { Test, TestingModule } from '@nestjs/testing';
import { EmailService } from './email.service';
import { PdfService } from '../pdf/pdf.service';
import { NutritionPlanDto } from '../../domain';

describe('EmailService', () => {
  let service: EmailService;
  let pdfService: jest.Mocked<PdfService>;
  let logSpy: jest.SpyInstance;

  const plan = {
    personalInfo: { name: 'Ana', lastName: 'Pérez', age: '30', date: '2026-09-06' },
  } as unknown as NutritionPlanDto;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [EmailService, { provide: PdfService, useValue: { generateBuffer: jest.fn() } }],
    }).compile();

    service = module.get(EmailService);
    pdfService = module.get(PdfService);
    logSpy = jest.spyOn((service as any).logger, 'log').mockImplementation(() => undefined);
  });

  it('genera el PDF del plan y "envía" el correo (stub) con el adjunto', async () => {
    const buffer = Buffer.from('contenido-pdf');
    pdfService.generateBuffer.mockResolvedValue(buffer);

    await service.sendPlanByEmail('ana@example.com', plan);

    expect(pdfService.generateBuffer).toHaveBeenCalledWith(plan);
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('correo simulado enviado a ana@example.com'),
    );
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('plan-nutricional-Ana-Pérez.pdf'));
  });

  it('propaga el error si la generación del PDF falla', async () => {
    pdfService.generateBuffer.mockRejectedValue(new Error('fallo de render'));

    await expect(service.sendPlanByEmail('ana@example.com', plan)).rejects.toThrow('fallo de render');
  });
});
