import { Test, TestingModule } from '@nestjs/testing';
import { ConsultationService } from './consultation.service';
import { OpenaiService } from '../openai/openai.service';
import { InputChatDtoImpl } from './dto/anamnesis-chat.dto';
import { OutputChatDto } from '../../domain';

describe('ConsultationService', () => {
  let service: ConsultationService;
  let openaiService: jest.Mocked<OpenaiService>;

  const body: InputChatDtoImpl = {
    messages: [{ role: 'user', content: 'quiero bajar de peso' }],
    anamnesis: null as any,
  };

  function fullOutput(overrides: Partial<OutputChatDto> = {}): OutputChatDto {
    return {
      reply: 'gracias por contarme',
      titleReply: 'Definición de objetivos',
      anamnesis: {
        goals: { primaryGoal: 'bajar de peso', secondaryGoal: null },
        clinical: {
          pathology: 'ninguna',
          familyMedicalHistory: null,
          allergies: 'ninguna',
          intolerances: 'ninguna',
          medications: 'ninguna',
          gastrointestinalHistory: null,
          bowelMovements: null,
          surgeries: null,
        },
        dietary: {
          r24h: [
            {
              mealTime: 'desayuno',
              cereals: 'pan',
              freeConsumptionVegetable: null,
              generalConsumptionVegetable: null,
              fruit: null,
              highFatProtein: null,
              lowFatProtein: null,
              highFatDairy: null,
              mediumFatDairy: null,
              lowFatDairy: null,
              highProteinDairy: null,
              highLipid: null,
              oil: null,
              sugar: null,
              alcohol: null,
            },
          ],
          foodPreferenceGroups: null,
          sportsStrategy: {
            supplement: null,
            hydration: null,
            preActivityMeal: null,
            duringActivityMeal: null,
            postActivityMeal: null,
          },
        },
        lifestyle: {
          alcohol: null,
          tobacco: null,
          physicalActivityLevel: 'moderado',
          sport: ['running'],
          sportSession: [
            {
              description: 'trote',
              discipline: 'running',
              duration: 40,
              intensity: 'moderada',
              eventType: 'entrenamiento',
              days: 'lunes',
              schedule: 'mañana',
            },
          ],
        },
      },
      isComplete: true,
      ...overrides,
    } as OutputChatDto;
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConsultationService,
        { provide: OpenaiService, useValue: { chatJson: jest.fn() } },
      ],
    }).compile();

    service = module.get(ConsultationService);
    openaiService = module.get(OpenaiService);
  });

  it('devuelve la respuesta del LLM tal cual cuando viene completa', async () => {
    openaiService.chatJson.mockResolvedValue(fullOutput());

    const result = await service.chat(body);

    expect(result.reply).toBe('gracias por contarme');
    expect(result.isComplete).toBe(true);
    expect(openaiService.chatJson).toHaveBeenCalledTimes(1);
  });

  it('reintenta una vez si el primer "reply" viene vacío, y usa el segundo intento', async () => {
    openaiService.chatJson
      .mockResolvedValueOnce(fullOutput({ reply: '   ' }))
      .mockResolvedValueOnce(fullOutput({ reply: 'segunda respuesta' }));

    const result = await service.chat(body);

    expect(result.reply).toBe('segunda respuesta');
    expect(openaiService.chatJson).toHaveBeenCalledTimes(2);
  });

  it('si tras el reintento el reply sigue vacío, usa el mensaje de resguardo', async () => {
    openaiService.chatJson.mockResolvedValue(fullOutput({ reply: '' }));

    const result = await service.chat(body);

    expect(result.reply).toBe('Disculpa, ¿podrías contarme un poco más sobre eso?');
    expect(openaiService.chatJson).toHaveBeenCalledTimes(2);
  });

  it('recalcula isComplete en el servidor: false si faltan campos obligatorios, aunque el LLM diga true', async () => {
    openaiService.chatJson.mockResolvedValue(
      fullOutput({
        isComplete: true,
        anamnesis: {
          goals: { primaryGoal: null, secondaryGoal: null },
          clinical: null,
          dietary: null,
          lifestyle: null,
        },
      }),
    );

    const result = await service.chat(body);

    expect(result.isComplete).toBe(false);
  });

  it('isComplete es false si alguna sportSession no tiene sus 7 campos completos', async () => {
    openaiService.chatJson.mockResolvedValue(
      fullOutput({
        isComplete: true,
        anamnesis: {
          ...fullOutput().anamnesis,
          lifestyle: {
            alcohol: null,
            tobacco: null,
            physicalActivityLevel: 'moderado',
            sport: ['running'],
            sportSession: [
              {
                description: 'trote',
                discipline: null, // campo faltante
                duration: 40,
                intensity: 'moderada',
                eventType: 'entrenamiento',
                days: 'lunes',
                schedule: 'mañana',
              },
            ],
          },
        },
      }),
    );

    const result = await service.chat(body);

    expect(result.isComplete).toBe(false);
  });
});
