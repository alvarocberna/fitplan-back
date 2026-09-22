import { Test, TestingModule } from '@nestjs/testing';
import { PlanGenerationService } from './plan-generation.service';
import { OrdersService } from '../orders/orders.service';
import { OpenaiService } from '../openai/openai.service';
import { EmailService } from '../notifications/email.service';
import { PdfService } from '../pdf/pdf.service';
import { ThumbnailService } from '../pdf/thumbnail.service';
import { StorageService } from '../storage/storage.service';
import { NutritionalPlanRepository } from '../../domain/repositories/clinical-domain/nutritional-plan.repository';
import { calculateAge } from '../../domain/services/utils/age.service';
import { calculateRequirements } from '../../domain/services/formulas/requirements.service';
import { determineMealTimes } from '../../domain/services/alimentos/meal-times.service';
import {
  defineFoodGroups,
  calculateFoodsAndIntake,
  calculateTotalPlanIntake,
  calculateTotalAdequacy,
  CalculatedMealTime,
} from '../../domain/services/alimentos/portion-adequacy.service';
import { FOOD_FIELD_TO_GROUP, FOOD_GROUP_PORTIONS } from '../../domain/services/alimentos/food-portions';
import { Meal } from '../../domain/dtos/consultation.dto';

// Construye, a partir de las porciones YA calculadas por el código real (numericPortions), una
// respuesta de IA "perfecta": para cada campo con porciones requeridas, arma un componente/
// equivalencia usando alimentos reales de FOOD_GROUP_PORTIONS escalados EXACTAMENTE a esas
// porciones (peso = porciones requeridas * peso base del alimento). Así el test no depende de
// tracear a mano el algoritmo de portion-adequacy.service.ts: reutiliza las mismas funciones de
// dominio que usa PlanGenerationService para saber qué debería devolver una IA que "acertó".
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

describe('PlanGenerationService', () => {
  let service: PlanGenerationService;
  let ordersService: jest.Mocked<OrdersService>;
  let openaiService: jest.Mocked<OpenaiService>;
  let emailService: jest.Mocked<EmailService>;
  let pdfService: jest.Mocked<PdfService>;
  let thumbnailService: jest.Mocked<ThumbnailService>;
  let storageService: jest.Mocked<StorageService>;
  let nutritionalPlanRepository: jest.Mocked<NutritionalPlanRepository>;

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
      carbohydrate: null,
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
    user: {
      rut: null,
      rutCheckDigit: null,
      firstName: 'Ana',
      middleName: null,
      paternalLastName: 'Pérez',
      maternalLastName: null,
      gender,
      email: 'ana@example.com',
      dateOfBirth,
    },
  } as any;

  const consultationEntity = {
    id: 'consultation-1',
    athlete: false,
    anamneses: [
      {
        anamnesisDietary: [
          {
            dietaryRecalls24h: [
              {
                meals: r24h.map((meal) => ({
                  mealTime: meal.mealTime,
                  carbohydrate: meal.carbohydrate,
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
        PlanGenerationService,
        {
          provide: OrdersService,
          useValue: {
            tryStartGeneration: jest.fn(),
            findByIdWithUser: jest.fn(),
            getConsultationForOrder: jest.fn(),
            completeGeneration: jest.fn(),
            recordFailedAttempt: jest.fn(),
          },
        },
        { provide: OpenaiService, useValue: { chatJson: jest.fn() } },
        { provide: EmailService, useValue: { sendPlanByEmail: jest.fn() } },
        { provide: PdfService, useValue: { generateBuffer: jest.fn() } },
        { provide: ThumbnailService, useValue: { generateFirstPage: jest.fn() } },
        {
          provide: StorageService,
          useValue: { uploadPdf: jest.fn(), uploadImage: jest.fn(), getSignedDownloadUrl: jest.fn() },
        },
        { provide: NutritionalPlanRepository, useValue: { upsertNutritionalPlanByOrderId: jest.fn() } },
      ],
    }).compile();

    service = module.get(PlanGenerationService);
    ordersService = module.get(OrdersService);
    openaiService = module.get(OpenaiService);
    emailService = module.get(EmailService);
    pdfService = module.get(PdfService);
    thumbnailService = module.get(ThumbnailService);
    storageService = module.get(StorageService);
    nutritionalPlanRepository = module.get(NutritionalPlanRepository);

    nutritionalPlanRepository.upsertNutritionalPlanByOrderId.mockResolvedValue({} as any);
    ordersService.tryStartGeneration.mockResolvedValue(true);
    ordersService.findByIdWithUser.mockResolvedValue(orderEntity);
    ordersService.getConsultationForOrder.mockResolvedValue(consultationEntity);
    pdfService.generateBuffer.mockResolvedValue(Buffer.from('contenido-pdf'));
    thumbnailService.generateFirstPage.mockResolvedValue(Buffer.from('contenido-miniatura'));
    storageService.uploadPdf.mockResolvedValue(undefined);
    storageService.uploadImage.mockResolvedValue(undefined);
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

    openaiService.chatJson
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
    ordersService.tryStartGeneration.mockResolvedValue(false);

    await service.generatePlan('order-1');

    expect(ordersService.findByIdWithUser).not.toHaveBeenCalled();
    expect(openaiService.chatJson).not.toHaveBeenCalled();
  });

  it('éxito en el primer intento: completa la orden y envía el correo con el plan calculado', async () => {
    const { requirements, portionAdequacyResult, totalIntake, adequacy } = mockMatchingAiResponses();

    await service.generatePlan('order-1');

    expect(openaiService.chatJson).toHaveBeenCalledTimes(2);
    expect(ordersService.completeGeneration).toHaveBeenCalledTimes(1);
    const [, plan, pdfKey, thumbnailKey] = ordersService.completeGeneration.mock.calls[0];

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
    // como adjunto del correo (no se vuelve a generar dentro de EmailService).
    expect(pdfKey).toBe('productos-personalizados/order-1.pdf');
    const pdfBuffer = await pdfService.generateBuffer.mock.results[0].value;
    expect(pdfService.generateBuffer).toHaveBeenCalledWith(plan);
    expect(storageService.uploadPdf).toHaveBeenCalledWith(pdfBuffer, pdfKey);
    expect(emailService.sendPlanByEmail).toHaveBeenCalledWith('ana@example.com', plan, pdfBuffer);
    expect(ordersService.recordFailedAttempt).not.toHaveBeenCalled();

    // la miniatura se rasteriza desde ese mismo buffer, se sube a S3 y su key se persiste en la orden.
    expect(thumbnailKey).toBe('productos-personalizados/miniaturas/order-1.webp');
    expect(thumbnailService.generateFirstPage).toHaveBeenCalledWith(pdfBuffer);
    expect(storageService.uploadImage).toHaveBeenCalledWith(
      Buffer.from('contenido-miniatura'),
      thumbnailKey,
    );
  });

  it('persiste el NutritionalPlan (por orderId) con los datos del plan, antes de marcar la orden como completada', async () => {
    const { requirements, totalIntake } = mockMatchingAiResponses();

    await service.generatePlan('order-1');

    expect(nutritionalPlanRepository.upsertNutritionalPlanByOrderId).toHaveBeenCalledTimes(1);
    expect(nutritionalPlanRepository.upsertNutritionalPlanByOrderId).toHaveBeenCalledWith({
      consultationId: 'consultation-1',
      orderId: 'order-1',
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
    });
    expect(nutritionalPlanRepository.upsertNutritionalPlanByOrderId.mock.invocationCallOrder[0]).toBeLessThan(
      ordersService.completeGeneration.mock.invocationCallOrder[0],
    );
  });

  it('si falla la persistencia del NutritionalPlan, la orden no se completa en ese intento y el reintento la completa', async () => {
    jest.useFakeTimers();
    mockMatchingAiResponses(); // 1er intento
    mockMatchingAiResponses(); // 2do intento (encola 2 respuestas más de la IA)
    nutritionalPlanRepository.upsertNutritionalPlanByOrderId.mockRejectedValueOnce(new Error('DB caída'));

    const resultPromise = service.generatePlan('order-1');
    await jest.advanceTimersByTimeAsync(60000);
    await resultPromise;

    expect(nutritionalPlanRepository.upsertNutritionalPlanByOrderId).toHaveBeenCalledTimes(2);
    expect(ordersService.completeGeneration).toHaveBeenCalledTimes(1);
    expect(ordersService.recordFailedAttempt).not.toHaveBeenCalled();

    jest.useRealTimers();
  });

  it.each([
    [
      'falla la rasterización',
      () => thumbnailService.generateFirstPage.mockRejectedValue(new Error('pdfjs roto')),
    ],
    [
      'falla la subida de la miniatura a S3',
      () => storageService.uploadImage.mockRejectedValue(new Error('S3 no disponible')),
    ],
  ])(
    'si %s, el plan igual se completa (thumbnailKey null), sin reintentar ni volver a llamar a la IA',
    async (_caso, breakThumbnail) => {
      mockMatchingAiResponses();
      breakThumbnail();

      await service.generatePlan('order-1');

      // 2 llamadas = un solo intento (extract + plan): la miniatura no consume reintentos.
      expect(openaiService.chatJson).toHaveBeenCalledTimes(2);
      expect(ordersService.completeGeneration).toHaveBeenCalledTimes(1);
      const [, , pdfKey, thumbnailKey] = ordersService.completeGeneration.mock.calls[0];
      expect(pdfKey).toBe('productos-personalizados/order-1.pdf');
      expect(thumbnailKey).toBeNull();
      expect(emailService.sendPlanByEmail).toHaveBeenCalledTimes(1);
      expect(ordersService.recordFailedAttempt).not.toHaveBeenCalled();
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
    openaiService.chatJson.mockImplementation(() => {
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

    const resultPromise = service.generatePlan('order-1');
    for (let i = 0; i < 5; i++) {
      await jest.advanceTimersByTimeAsync(60000);
    }
    await resultPromise;

    expect(openaiService.chatJson).toHaveBeenCalledTimes(8); // 2 llamadas (extract + plan) x 4 intentos
    expect(ordersService.completeGeneration).not.toHaveBeenCalled();
    expect(emailService.sendPlanByEmail).not.toHaveBeenCalled();
    expect(ordersService.recordFailedAttempt).toHaveBeenCalledWith('order-1');

    jest.useRealTimers();
  });
});
