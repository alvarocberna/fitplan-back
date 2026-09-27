import { Test, TestingModule } from '@nestjs/testing';
import { GeneratePersonalizedPlanUseCase } from './generate-personalized-plan.use-case';
import { OrderLifecycleService } from '../../billing/order-lifecycle.service';
import {
  EmailSender,
  FileStorage,
  LlmProvider,
  PlanDocumentRenderer,
} from '../../../domain/ports';
import { NutritionalConsultationRepository } from '../../../domain/repositories/clinical-domain/nutritional-consultation.repository';
import { PlanRepository } from '../../../domain/repositories/clinical-domain/plan.repository';
import { calculateAge } from '../../../domain/services/utils/age.service';
import { calculateRequirements } from '../../../domain/services/formulas/requirements.service';
import { determineMealTimes } from '../../../domain/services/alimentos/meal-times.service';
import {
  defineFoodGroups,
  calculateFoodsAndIntake,
  calculateTotalPlanIntake,
  calculateTotalAdequacy,
  CalculatedMealTime,
} from '../../../domain/services/alimentos/portion-adequacy.service';
import { FOOD_FIELD_TO_GROUP, FOOD_GROUP_PORTIONS } from '../../../domain/services/alimentos/food-portions';
import { Meal } from '../../../domain/dtos/consultation.dto';

// Construye, a partir de las porciones YA calculadas por el código real (numericPortions), una
// respuesta de IA "perfecta": para cada campo con porciones requeridas, arma un componente/
// equivalencia usando alimentos reales de FOOD_GROUP_PORTIONS escalados EXACTAMENTE a esas
// porciones (peso = porciones requeridas * peso base del alimento). Así el test no depende de
// tracear a mano el algoritmo de portion-adequacy.service.ts: reutiliza las mismas funciones de
// dominio que usa GeneratePersonalizedPlanUseCase para saber qué debería devolver una IA que "acertó".
function buildMatchingGeneratedMealTimes(calculatedMealTimes: CalculatedMealTime[]) {
  return calculatedMealTimes.map((calculated) => {
    const numericPortions = calculated.numericPortions as unknown as Record<string, number>;
    const components: { field: string; food: string; weight: number }[] = [];
    const equivalenceGroups: { field: string; options: { text: string; food: string; weight: number }[] }[] = [];

    for (const [field, required] of Object.entries(numericPortions)) {
      if (!required) continue;
      const groupInfo = FOOD_FIELD_TO_GROUP[field];
      const groupData = FOOD_GROUP_PORTIONS.find(
        (g) => g.group === groupInfo.group && g.subcategory === groupInfo.subcategory,
      )!;
      const candidates = groupData.foods.filter((f) => f.weight != null).slice(0, 3);

      components.push({
        field,
        food: candidates[0].food,
        weight: required * (candidates[0].weight as number),
      });

      equivalenceGroups.push({
        field,
        options: candidates.map((f) => ({
          text: `${f.food} (${required} porciones)`,
          food: f.food,
          weight: required * (f.weight as number),
        })),
      });
    }

    const example = { text: 'ejemplo de comida', components };
    return {
      hour: '08:00',
      examples: [example, example, example],
      equivalences: equivalenceGroups,
      comments: ['comentario de ejemplo'],
    };
  });
}

describe('GeneratePersonalizedPlanUseCase', () => {
  let service: GeneratePersonalizedPlanUseCase;
  let orderLifecycle: jest.Mocked<OrderLifecycleService>;
  let llm: jest.Mocked<LlmProvider>;
  let emailSender: jest.Mocked<EmailSender>;
  let documentRenderer: jest.Mocked<PlanDocumentRenderer>;
  let fileStorage: jest.Mocked<FileStorage>;
  let nutritionalConsultationRepository: jest.Mocked<NutritionalConsultationRepository>;
  let planRepository: jest.Mocked<PlanRepository>;

  const dateOfBirth = new Date('1996-01-01');
  const weight = 70;
  const height = 175;
  const gender = 'F';
  const goal = 'mantencion';
  const physicalActivityLevel = 1.2;
  const somatotype = 'ENDO';

  const r24h: Meal[] = [
    {
      mealTime: 'desayuno',
      cereals: null,
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
  ];

  const orderEntity = {
    id: 'order-1',
    product: { name: 'Plan personalizado' },
    user: {
      rut: null,
      rutCheckDigit: null,
      firstName: 'Ana',
      middleName: null,
      paternalLastName: 'Pérez',
      maternalLastName: null,
      gender,
      athlete: false,
      email: 'ana@example.com',
      dateOfBirth,
    },
  } as any;

  const consultationEntity = {
    id: 'consultation-1',
    anamneses: [
      {
        anamnesisDietary: [
          {
            dietaryRecalls24h: [
              {
                meals: r24h.map((meal) => ({
                  mealTime: meal.mealTime,
                  cereals: meal.cereals,
                  freeConsumptionVegetable: meal.freeConsumptionVegetable,
                  generalConsumptionVegetable: meal.generalConsumptionVegetable,
                  fruit: meal.fruit,
                  highFatProtein: meal.highFatProtein,
                  lowFatProtein: meal.lowFatProtein,
                  highFatDairy: meal.highFatDairy,
                  mediumFatDairy: meal.mediumFatDairy,
                  lowFatDairy: meal.lowFatDairy,
                  highProteinDairy: meal.highProteinDairy,
                  lipidRich: meal.highLipid,
                  oil: meal.oil,
                  sugar: meal.sugar,
                  alcohol: meal.alcohol,
                })),
              },
            ],
          },
        ],
      },
    ],
    measurements: [{ description: somatotype, basicMeasurements: [{ weight, height }] }],
  } as any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GeneratePersonalizedPlanUseCase,
        {
          provide: OrderLifecycleService,
          useValue: {
            tryStartGeneration: jest.fn(),
            findByIdWithUser: jest.fn(),
            completeGeneration: jest.fn(),
            recordFailedAttempt: jest.fn(),
          },
        },
        { provide: LlmProvider, useValue: { chatJson: jest.fn() } },
        { provide: EmailSender, useValue: { sendPlanByEmail: jest.fn() } },
        {
          provide: PlanDocumentRenderer,
          useValue: { renderPdf: jest.fn(), renderThumbnail: jest.fn() },
        },
        {
          provide: FileStorage,
          useValue: { uploadPdf: jest.fn(), uploadImage: jest.fn(), getSignedDownloadUrl: jest.fn() },
        },
        {
          provide: NutritionalConsultationRepository,
          useValue: { getNutritionalConsultationWithDetailsByOrderId: jest.fn() },
        },
        { provide: PlanRepository, useValue: { upsertPlanWithMainNutritionalPlanByOrderId: jest.fn() } },
      ],
    }).compile();

    service = module.get(GeneratePersonalizedPlanUseCase);
    orderLifecycle = module.get(OrderLifecycleService);
    llm = module.get(LlmProvider);
    emailSender = module.get(EmailSender);
    documentRenderer = module.get(PlanDocumentRenderer);
    fileStorage = module.get(FileStorage);
    nutritionalConsultationRepository = module.get(NutritionalConsultationRepository);
    planRepository = module.get(PlanRepository);

    planRepository.upsertPlanWithMainNutritionalPlanByOrderId.mockResolvedValue({} as any);
    orderLifecycle.tryStartGeneration.mockResolvedValue(true);
    orderLifecycle.findByIdWithUser.mockResolvedValue(orderEntity);
    nutritionalConsultationRepository.getNutritionalConsultationWithDetailsByOrderId.mockResolvedValue(consultationEntity);
    documentRenderer.renderPdf.mockResolvedValue(Buffer.from('contenido-pdf'));
    documentRenderer.renderThumbnail.mockResolvedValue(Buffer.from('contenido-miniatura'));
    fileStorage.uploadPdf.mockResolvedValue(undefined);
    fileStorage.uploadImage.mockResolvedValue(undefined);
  });

  // Deja al mock de OpenAI respondiendo "perfecto" (calza con las porciones calculadas por el
  // código) y devuelve lo calculado para que cada test pueda contrastarlo con el plan resultante.
  function mockMatchingAiResponses() {
    const age = calculateAge(dateOfBirth);
    const requirements = calculateRequirements({
      weight,
      height,
      gender,
      age,
      physicalActivityLevel,
      goal,
      athlete: false,
      somatotype,
    });
    const finalMealTimes = determineMealTimes(r24h, goal);
    const mealTimeGroups = defineFoodGroups(finalMealTimes);
    const portionAdequacyResult = calculateFoodsAndIntake(mealTimeGroups, requirements);
    const totalIntake = calculateTotalPlanIntake(portionAdequacyResult);
    const adequacy = calculateTotalAdequacy(totalIntake, requirements);

    llm.chatJson
      .mockResolvedValueOnce({ physicalActivityLevel, goal }) // extractInfoPrompt
      .mockResolvedValueOnce({
        prescription: { regimen: 'Plan personalizado', goal },
        mealTimes: buildMatchingGeneratedMealTimes(portionAdequacyResult.calculatedMealTimes),
        supplements: [],
        sportsRecommendations: {},
      }); // prompt principal

    return { requirements, portionAdequacyResult, totalIntake, adequacy };
  }

  it('si tryStartGeneration devuelve false (ya en curso/completado), no hace nada más', async () => {
    orderLifecycle.tryStartGeneration.mockResolvedValue(false);

    await service.execute({ orderId: 'order-1' });

    expect(orderLifecycle.findByIdWithUser).not.toHaveBeenCalled();
    expect(llm.chatJson).not.toHaveBeenCalled();
  });

  it('éxito en el primer intento: completa la orden y envía el correo con el plan calculado', async () => {
    const { requirements, portionAdequacyResult, totalIntake, adequacy } = mockMatchingAiResponses();

    await service.execute({ orderId: 'order-1' });

    expect(llm.chatJson).toHaveBeenCalledTimes(2);
    expect(orderLifecycle.completeGeneration).toHaveBeenCalledTimes(1);
    const [, plan, pdfKey, thumbnailKey] = orderLifecycle.completeGeneration.mock.calls[0];

    expect(plan.prescription).toMatchObject({
      regimen: 'Plan personalizado',
      goal,
      calories: requirements.calories,
      protein: requirements.protein,
      carbohydrate: requirements.carbohydrate,
      fat: requirements.fat,
    });
    expect(plan.planIntake.totalIntake).toEqual(totalIntake);
    expect(plan.planIntake.adequacy).toEqual(adequacy);
    expect(plan.mealTimes).toHaveLength(portionAdequacyResult.calculatedMealTimes.length);
    expect(plan.personalInfo).toMatchObject({ name: 'Ana', lastName: 'Pérez' });

    // el PDF se genera UNA sola vez, se sube a S3 con esa key, y el mismo buffer se reutiliza
    // como adjunto del correo (no se vuelve a generar dentro de EmailSender).
    expect(pdfKey).toBe('productos-personalizados/order-1.pdf');
    const pdfBuffer = await documentRenderer.renderPdf.mock.results[0].value;
    expect(documentRenderer.renderPdf).toHaveBeenCalledWith(plan);
    expect(fileStorage.uploadPdf).toHaveBeenCalledWith(pdfBuffer, pdfKey);
    expect(emailSender.sendPlanByEmail).toHaveBeenCalledWith('ana@example.com', plan, pdfBuffer);
    expect(orderLifecycle.recordFailedAttempt).not.toHaveBeenCalled();

    // la miniatura se rasteriza desde ese mismo buffer, se sube a S3 y su key se persiste en la orden.
    expect(thumbnailKey).toBe('productos-personalizados/miniaturas/order-1.webp');
    expect(documentRenderer.renderThumbnail).toHaveBeenCalledWith(pdfBuffer);
    expect(fileStorage.uploadImage).toHaveBeenCalledWith(
      Buffer.from('contenido-miniatura'),
      thumbnailKey,
    );
  });

  it('persiste el Plan (por orderId) con su NutritionalPlan principal, antes de marcar la orden como completada', async () => {
    const { requirements, totalIntake } = mockMatchingAiResponses();

    await service.execute({ orderId: 'order-1' });

    expect(planRepository.upsertPlanWithMainNutritionalPlanByOrderId).toHaveBeenCalledTimes(1);
    expect(planRepository.upsertPlanWithMainNutritionalPlanByOrderId).toHaveBeenCalledWith({
      consultationId: 'consultation-1',
      orderId: 'order-1',
      nutritionalPlan: {
        planName: 'Plan personalizado',
        period: null,
        mainPlan: true,
        startDate: expect.any(Date),
        endDate: null,
        goal,
        dietRegimen: 'Plan personalizado',
        calorieRequirement: requirements.calories,
        proteinRequirement: requirements.protein,
        carbohydrateRequirement: requirements.carbohydrate,
        lipidRequirement: requirements.fat,
        calorieIntake: totalIntake.calories,
        proteinIntake: totalIntake.protein,
        carbohydrateIntake: totalIntake.carbohydrate,
        lipidIntake: totalIntake.fat,
      },
    });
    expect(planRepository.upsertPlanWithMainNutritionalPlanByOrderId.mock.invocationCallOrder[0]).toBeLessThan(
      orderLifecycle.completeGeneration.mock.invocationCallOrder[0],
    );
  });

  it('si falla la persistencia del Plan, la orden no se completa en ese intento y el reintento la completa', async () => {
    jest.useFakeTimers();
    mockMatchingAiResponses(); // 1er intento
    mockMatchingAiResponses(); // 2do intento (encola 2 respuestas más de la IA)
    planRepository.upsertPlanWithMainNutritionalPlanByOrderId.mockRejectedValueOnce(new Error('DB caída'));

    const resultPromise = service.execute({ orderId: 'order-1' });
    await jest.advanceTimersByTimeAsync(60000);
    await resultPromise;

    expect(planRepository.upsertPlanWithMainNutritionalPlanByOrderId).toHaveBeenCalledTimes(2);
    expect(orderLifecycle.completeGeneration).toHaveBeenCalledTimes(1);
    expect(orderLifecycle.recordFailedAttempt).not.toHaveBeenCalled();

    jest.useRealTimers();
  });

  it.each([
    [
      'falla la rasterización',
      () => documentRenderer.renderThumbnail.mockRejectedValue(new Error('pdfjs roto')),
    ],
    [
      'falla la subida de la miniatura a S3',
      () => fileStorage.uploadImage.mockRejectedValue(new Error('S3 no disponible')),
    ],
  ])(
    'si %s, el plan igual se completa (thumbnailKey null), sin reintentar ni volver a llamar a la IA',
    async (_caso, breakThumbnail) => {
      mockMatchingAiResponses();
      breakThumbnail();

      await service.execute({ orderId: 'order-1' });

      // 2 llamadas = un solo intento (extract + plan): la miniatura no consume reintentos.
      expect(llm.chatJson).toHaveBeenCalledTimes(2);
      expect(orderLifecycle.completeGeneration).toHaveBeenCalledTimes(1);
      const [, , pdfKey, thumbnailKey] = orderLifecycle.completeGeneration.mock.calls[0];
      expect(pdfKey).toBe('productos-personalizados/order-1.pdf');
      expect(thumbnailKey).toBeNull();
      expect(emailSender.sendPlanByEmail).toHaveBeenCalledTimes(1);
      expect(orderLifecycle.recordFailedAttempt).not.toHaveBeenCalled();
    },
  );

  it('reintenta con backoff si la IA no calza con las porciones calculadas, y agota los 4 intentos', async () => {
    jest.useFakeTimers();

    // "examples" vacío en cada intento dispara PlanValidationError determinísticamente
    // (validateGeneratedExamples exige exactamente 3 ejemplos por tiempo de comida), sin
    // importar los requerimientos/porciones calculados para este escenario. Cada intento de
    // processPlan() llama a chatJson 2 veces en orden fijo: 1ro extractInfoPrompt, 2do el prompt
    // principal (ver plan-generation.service.ts) — se alterna la respuesta con un contador.
    let callCount = 0;
    llm.chatJson.mockImplementation(() => {
      callCount++;
      if (callCount % 2 === 1) {
        return Promise.resolve({ physicalActivityLevel, goal });
      }
      return Promise.resolve({
        prescription: { regimen: 'Plan personalizado', goal },
        mealTimes: determineMealTimes(r24h, goal).map(() => ({
          hour: null,
          examples: [],
          equivalences: [],
          comments: [],
        })),
        supplements: [],
        sportsRecommendations: {},
      });
    });

    const resultPromise = service.execute({ orderId: 'order-1' });
    for (let i = 0; i < 5; i++) {
      await jest.advanceTimersByTimeAsync(60000);
    }
    await resultPromise;

    expect(llm.chatJson).toHaveBeenCalledTimes(8); // 2 llamadas (extract + plan) x 4 intentos
    expect(orderLifecycle.completeGeneration).not.toHaveBeenCalled();
    expect(emailSender.sendPlanByEmail).not.toHaveBeenCalled();
    expect(orderLifecycle.recordFailedAttempt).toHaveBeenCalledWith('order-1');

    jest.useRealTimers();
  });
});
