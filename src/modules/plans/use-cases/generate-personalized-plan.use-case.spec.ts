import { Test, TestingModule } from '@nestjs/testing';
import { GeneratePersonalizedPlanUseCase } from './generate-personalized-plan.use-case';
import { OrderLifecycleService } from '../../billing/order-lifecycle.service';
import {
  AlertNotifier,
  EmailSender,
  FileStorage,
  LlmProvider,
  PlanDocumentRenderer,
} from '../../../domain/ports';
import { NutritionalConsultationRepository } from '../../../domain/repositories/clinical-domain/nutritional-consultation.repository';
import { PlanRepository } from '../../../domain/repositories/clinical-domain/plan.repository';
import { MeasurementsRepository } from '../../../domain/repositories/clinical-domain/measurements.repository';
import { calculateAge } from '../../../domain/services/utils/age.service';
import { calculateRequirements } from '../../../domain/services/formulas/requirements/requirements.service';
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
  let alertNotifier: jest.Mocked<AlertNotifier>;
  let documentRenderer: jest.Mocked<PlanDocumentRenderer>;
  let fileStorage: jest.Mocked<FileStorage>;
  let nutritionalConsultationRepository: jest.Mocked<NutritionalConsultationRepository>;
  let planRepository: jest.Mocked<PlanRepository>;
  let measurementsRepository: jest.Mocked<MeasurementsRepository>;

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
    userId: 'user-1',
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
        { provide: AlertNotifier, useValue: { notify: jest.fn() } },
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
        { provide: MeasurementsRepository, useValue: { listMeasurementsByPatientId: jest.fn() } },
      ],
    }).compile();

    service = module.get(GeneratePersonalizedPlanUseCase);
    orderLifecycle = module.get(OrderLifecycleService);
    llm = module.get(LlmProvider);
    emailSender = module.get(EmailSender);
    alertNotifier = module.get(AlertNotifier);
    documentRenderer = module.get(PlanDocumentRenderer);
    fileStorage = module.get(FileStorage);
    nutritionalConsultationRepository = module.get(NutritionalConsultationRepository);
    planRepository = module.get(PlanRepository);
    measurementsRepository = module.get(MeasurementsRepository);

    planRepository.upsertPlanWithMainNutritionalPlanByOrderId.mockResolvedValue({} as any);
    measurementsRepository.listMeasurementsByPatientId.mockResolvedValue([]);
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
  function mockMatchingAiResponses(classifiedGoal: string = goal) {
    const age = calculateAge(dateOfBirth);
    const requirements = calculateRequirements({
      weight,
      height,
      gender,
      age,
      physicalActivityLevel,
      goal: classifiedGoal,
      athlete: false,
      somatotype,
    });
    const finalMealTimes = determineMealTimes(r24h, classifiedGoal);
    const mealTimeGroups = defineFoodGroups(finalMealTimes);
    const portionAdequacyResult = calculateFoodsAndIntake(mealTimeGroups, requirements);
    const totalIntake = calculateTotalPlanIntake(portionAdequacyResult);
    const adequacy = calculateTotalAdequacy(totalIntake, requirements);

    llm.chatJson
      .mockResolvedValueOnce({ physicalActivityLevel, goal: classifiedGoal }) // extractInfoPrompt
      .mockResolvedValueOnce({
        prescription: { regimen: 'Plan personalizado', goal },
        mealTimes: buildMatchingGeneratedMealTimes(portionAdequacyResult.calculatedMealTimes),
        supplements: [],
        sportsRecommendations: [],
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
    // la llamada que genera el plan declara su propio timeout (minutos) y no usa los reintentos del
    // SDK: con el tope por defecto del adaptador (60 s) la generación nunca alcanzaba a responder
    const planCallOptions = llm.chatJson.mock.calls[1][4];
    expect(planCallOptions).toMatchObject({ timeoutMs: 5 * 60_000, maxRetries: 0 });
    expect(llm.chatJson.mock.calls[0][4]).toMatchObject({ timeoutMs: 60_000, maxRetries: 0 });
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

  it('en mantención fija el end_date del plan en 3 meses desde el inicio', async () => {
    mockMatchingAiResponses();

    await service.execute({ orderId: 'order-1' });

    const [{ nutritionalPlan }] =
      planRepository.upsertPlanWithMainNutritionalPlanByOrderId.mock.calls[0];
    const expectedEnd = new Date(nutritionalPlan.startDate);
    expectedEnd.setUTCMonth(expectedEnd.getUTCMonth() + 3);
    expect(nutritionalPlan.endDate).toEqual(expectedEnd);
  });

  it('en definición persiste la proyección (usando la composición corporal más reciente) y su end_date', async () => {
    measurementsRepository.listMeasurementsByPatientId.mockResolvedValue([
      { measurementResults: [{ bfPercentage: null, mmKg: null }] },
      { measurementResults: [{ bfPercentage: 30, mmKg: 25 }] },
    ] as any);
    mockMatchingAiResponses('definicion');

    await service.execute({ orderId: 'order-1' });

    expect(measurementsRepository.listMeasurementsByPatientId).toHaveBeenCalledWith('user-1');
    const [{ nutritionalPlan, projection }] =
      planRepository.upsertPlanWithMainNutritionalPlanByOrderId.mock.calls[0];
    // 70 kg / 175 cm, 30% GC, mujer: -2 kg/mes x 3 meses -> 64 kg, IMC 20,9, 23,4% GC
    expect(projection).toEqual({
      projectedStartDate: nutritionalPlan.startDate,
      projectedEndDate: nutritionalPlan.endDate,
      projectedWeight: 64,
      projectedBmi: 20.9,
      projectedBfKg: 15,
      projectedBfPercentage: 23.4,
      projectedMmKg: 25,
      projectedMmPercentage: 39.1,
    });
  });

  it('persiste el Plan (por orderId) con su NutritionalPlan principal y sus tablas hijas, antes de marcar la orden como completada', async () => {
    const { requirements, totalIntake, portionAdequacyResult } = mockMatchingAiResponses();

    await service.execute({ orderId: 'order-1' });

    expect(planRepository.upsertPlanWithMainNutritionalPlanByOrderId).toHaveBeenCalledTimes(1);
    expect(planRepository.upsertPlanWithMainNutritionalPlanByOrderId).toHaveBeenCalledWith({
      consultationId: 'consultation-1',
      orderId: 'order-1',
      nutritionalPlan: expect.objectContaining({
        planName: 'Plan personalizado',
        period: null,
        mainPlan: true,
        startDate: expect.any(Date),
        endDate: expect.any(Date),
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
        supplements: [],
        sportsRecommendations: [],
      }),
      // objetivo "mantencion": sin proyección de peso
      projection: null,
    });

    // un plan_meal_time por tiempo de comida calculado, con las porciones numéricas del cálculo real
    // (no parseadas del texto) y los ejemplos/comentarios/equivalencias de la IA como notas
    const [{ nutritionalPlan }] =
      planRepository.upsertPlanWithMainNutritionalPlanByOrderId.mock.calls[0];
    const { calculatedMealTimes } = portionAdequacyResult;
    expect(nutritionalPlan.mealTimes).toHaveLength(calculatedMealTimes.length);
    nutritionalPlan.mealTimes.forEach((mealTime, index) => {
      const { numericPortions } = calculatedMealTimes[index];
      expect(mealTime.hour).toBe('08:00');
      expect(mealTime.calorieIntake).toBe(calculatedMealTimes[index].intake.calories);
      expect(mealTime.cereal).toBe(numericPortions.cereals || null);
      expect(mealTime.lowFatProtein).toBe(numericPortions.lowFatProteins || null);
      expect(mealTime.notes.filter((n) => n.type === 'EXAMPLE')).toHaveLength(3);
      expect(mealTime.notes.filter((n) => n.type === 'COMMENT')).toHaveLength(1);
      const groupsWithPortions = Object.values(numericPortions).filter((p) => p > 0).length;
      expect(mealTime.notes.filter((n) => n.type === 'EQUIVALENCE')).toHaveLength(groupsWithPortions);
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

  it('lee el modelo del plan del entorno en cada ejecución (no al importar el archivo)', async () => {
    const previous = process.env.OPENAI_MODEL_PLAN;
    process.env.OPENAI_MODEL_PLAN = 'modelo-de-prueba';
    mockMatchingAiResponses();

    await service.execute({ orderId: 'order-1' });

    process.env.OPENAI_MODEL_PLAN = previous;
    if (previous === undefined) delete process.env.OPENAI_MODEL_PLAN;
    expect(llm.chatJson.mock.calls.map((call) => call[2])).toEqual(['modelo-de-prueba', 'modelo-de-prueba']);
  });

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
        sportsRecommendations: [],
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
    // primera ronda fallida: quedan reintentos automáticos, la alerta es solo un aviso
    expect(alertNotifier.notify).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'plan_generation_failed',
        severity: 'warning',
        context: expect.objectContaining({ orderId: 'order-1', failedRounds: 1, final: false }),
      }),
    );

    jest.useRealTimers();
  });

  it('si la ronda que falla era la última (attempts agotados), la alerta es crítica', async () => {
    jest.useFakeTimers();
    // la orden ya lleva 3 rondas fallidas: esta es la cuarta y última
    orderLifecycle.findByIdWithUser.mockResolvedValue({ ...orderEntity, attempts: 3 });
    llm.chatJson.mockRejectedValue(new Error('OpenAI no respondió'));

    const resultPromise = service.execute({ orderId: 'order-1' });
    for (let i = 0; i < 5; i++) {
      await jest.advanceTimersByTimeAsync(60000);
    }
    await resultPromise;

    expect(orderLifecycle.recordFailedAttempt).toHaveBeenCalledWith('order-1');
    expect(alertNotifier.notify).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'plan_generation_failed',
        severity: 'critical',
        context: expect.objectContaining({ failedRounds: 4, final: true }),
      }),
    );

    jest.useRealTimers();
  });

  it('si falla el envío del correo, el plan queda completado: no se regenera ni se marca en ERROR', async () => {
    mockMatchingAiResponses();
    emailSender.sendPlanByEmail.mockRejectedValue(new Error('SES caído'));

    await expect(service.execute({ orderId: 'order-1' })).resolves.toBeUndefined();

    expect(llm.chatJson).toHaveBeenCalledTimes(2); // una sola generación
    expect(orderLifecycle.completeGeneration).toHaveBeenCalledTimes(1);
    expect(orderLifecycle.recordFailedAttempt).not.toHaveBeenCalled();
    expect(alertNotifier.notify).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'plan_email_failed', severity: 'warning' }),
    );
  });

  it('si el usuario no tiene email, el plan queda completado y simplemente no se envía el correo', async () => {
    mockMatchingAiResponses();
    orderLifecycle.findByIdWithUser.mockResolvedValue({
      ...orderEntity,
      user: { ...orderEntity.user, email: null },
    });

    await service.execute({ orderId: 'order-1' });

    expect(orderLifecycle.completeGeneration).toHaveBeenCalledTimes(1);
    expect(emailSender.sendPlanByEmail).not.toHaveBeenCalled();
    expect(orderLifecycle.recordFailedAttempt).not.toHaveBeenCalled();
  });

  it('si no se pueden cargar los datos de la orden, la ronda se da por fallida (no queda en GENERATING)', async () => {
    nutritionalConsultationRepository.getNutritionalConsultationWithDetailsByOrderId.mockResolvedValue(null);

    await expect(service.execute({ orderId: 'order-1' })).resolves.toBeUndefined();

    expect(llm.chatJson).not.toHaveBeenCalled();
    expect(orderLifecycle.recordFailedAttempt).toHaveBeenCalledWith('order-1');
    expect(alertNotifier.notify).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'plan_generation_failed' }),
    );
  });

  it('si ni siquiera se puede registrar la ronda fallida, el error queda contenido', async () => {
    orderLifecycle.findByIdWithUser.mockRejectedValue(new Error('db caída'));
    orderLifecycle.recordFailedAttempt.mockRejectedValue(new Error('db caída'));

    await expect(service.execute({ orderId: 'order-1' })).resolves.toBeUndefined();
    expect(alertNotifier.notify).toHaveBeenCalled();
  });

  describe('instrumentación (tiempos por fase)', () => {
    // objetos estructurados que el caso de uso loguea (resumen de intento y de ronda)
    function structuredLogs(spy: jest.SpyInstance, event: string): any[] {
      return spy.mock.calls
        .map(([message]) => message)
        .filter((message) => typeof message === 'object' && message?.event === event);
    }

    let logSpy: jest.SpyInstance;
    const previousFlag = process.env.PLAN_GENERATION_TIMING_LOGS;

    beforeEach(() => {
      process.env.PLAN_GENERATION_TIMING_LOGS = 'true';
      logSpy = jest.spyOn((service as any).logger, 'log').mockImplementation(() => undefined);
      jest.spyOn((service as any).logger, 'warn').mockImplementation(() => undefined);
      jest.spyOn((service as any).logger, 'error').mockImplementation(() => undefined);
    });

    afterEach(() => {
      if (previousFlag === undefined) delete process.env.PLAN_GENERATION_TIMING_LOGS;
      else process.env.PLAN_GENERATION_TIMING_LOGS = previousFlag;
    });

    it.each([[undefined], ['false'], ['1'], ['TRUE']])(
      'con PLAN_GENERATION_TIMING_LOGS=%p no emite ningún log de tiempos (solo con "true")',
      async (value) => {
        if (value === undefined) delete process.env.PLAN_GENERATION_TIMING_LOGS;
        else process.env.PLAN_GENERATION_TIMING_LOGS = value;
        mockMatchingAiResponses();

        await service.execute({ orderId: 'order-1' });

        expect(structuredLogs(logSpy, 'plan_generation_attempt')).toHaveLength(0);
        expect(structuredLogs(logSpy, 'plan_generation_round')).toHaveLength(0);
        const lines = logSpy.mock.calls.map(([message]) => message).filter((m) => typeof m === 'string');
        expect(lines.some((line) => /\] \w+: \d+ ms/.test(line))).toBe(false);
        // el log de operación de siempre se mantiene, y el plan se genera igual
        expect(lines.some((line) => line.includes('plan generado con éxito'))).toBe(true);
        expect(orderLifecycle.completeGeneration).toHaveBeenCalledTimes(1);
      },
    );

    it('ronda exitosa: registra todas las fases, en orden, y un resumen de intento y de ronda', async () => {
      // respuesta "perfecta" del modelo, que además informa sus métricas a través de onMetrics
      const { portionAdequacyResult } = mockMatchingAiResponses();
      const responses = [
        { physicalActivityLevel, goal },
        {
          prescription: { regimen: 'Plan personalizado', goal },
          mealTimes: buildMatchingGeneratedMealTimes(portionAdequacyResult.calculatedMealTimes),
          supplements: [],
          sportsRecommendations: [],
        },
      ];
      llm.chatJson.mockReset();
      llm.chatJson.mockImplementation(async (...args: any[]) => {
        const index = llm.chatJson.mock.calls.length - 1;
        args[4]?.onMetrics?.({
          model: 'gpt-5-mini',
          durationMs: 0,
          promptTokens: index === 1 ? 9000 : 500,
          completionTokens: index === 1 ? 6000 : 20,
          reasoningTokens: index === 1 ? 4000 : 0,
          totalTokens: index === 1 ? 15000 : 520,
        });
        return responses[index] as any;
      });
      orderLifecycle.findByIdWithUser.mockResolvedValue({
        ...orderEntity,
        paymentDate: new Date(Date.now() - 5000),
      });

      await service.execute({ orderId: 'order-1', trigger: 'payment' });

      const [attempt] = structuredLogs(logSpy, 'plan_generation_attempt');
      expect(attempt).toMatchObject({ orderId: 'order-1', attempt: 1, ok: true });
      expect(attempt.phases.map((phase: any) => phase.phase)).toEqual([
        'llm_classify',
        'calculate',
        'build_prompt',
        'llm_plan',
        'validate',
        'merge',
        'render_pdf',
        'upload_pdf',
        'render_thumbnail',
        'upload_thumbnail',
        'persist_plan',
        'complete_order',
      ]);
      // las métricas del modelo quedan en la fase de su llamada; el prompt y el PDF, con su tamaño
      const phase = (name: string) => attempt.phases.find((item: any) => item.phase === name);
      expect(phase('llm_plan').data).toMatchObject({
        model: 'gpt-5-mini',
        promptTokens: 9000,
        completionTokens: 6000,
        reasoningTokens: 4000,
      });
      expect(phase('build_prompt').data.chars).toBeGreaterThan(0);
      expect(phase('render_pdf').data).toEqual({ bytes: Buffer.from('contenido-pdf').length });

      const [round] = structuredLogs(logSpy, 'plan_generation_round');
      expect(round).toMatchObject({
        orderId: 'order-1',
        trigger: 'payment',
        outcome: 'completed',
        attempts: 1,
        tokens: { prompt: 9500, completion: 6020, reasoning: 4000 },
      });
      expect(round.queueWaitMs).toBeGreaterThanOrEqual(5000);
      // la ronda suma además las fases de fuera del intento; la espera en cola va aparte
      const roundPhases = round.phases.map((item: any) => item.phase);
      expect(roundPhases).toEqual(
        expect.arrayContaining(['start_guard', 'load_data', 'load_baseline', 'llm_plan', 'send_email']),
      );
      expect(roundPhases).not.toContain('queue_wait');
    });

    it('nunca loguea contenido de la consulta ni el prompt, solo duraciones, tamaños y conteos', async () => {
      mockMatchingAiResponses();

      await service.execute({ orderId: 'order-1' });

      const logged = JSON.stringify(logSpy.mock.calls);
      expect(logged).not.toContain('ana@example.com');
      expect(logged).not.toContain('Pérez');
      expect(logged).not.toContain('Eres un nutricionista');
    });

    it('intento fallido: el resumen marca ok: false y la fase donde falló; la ronda queda failed', async () => {
      jest.useFakeTimers();
      llm.chatJson.mockRejectedValue(new Error('OpenAI no respondió: Request timed out.'));

      const resultPromise = service.execute({ orderId: 'order-1', trigger: 'retry' });
      for (let i = 0; i < 5; i++) {
        await jest.advanceTimersByTimeAsync(60000);
      }
      await resultPromise;

      const attempts = structuredLogs(logSpy, 'plan_generation_attempt');
      expect(attempts).toHaveLength(4);
      expect(attempts[0]).toMatchObject({ attempt: 1, ok: false, slowest: 'llm_classify' });
      expect(attempts[0].phases).toEqual([
        expect.objectContaining({ phase: 'llm_classify', ok: false }),
      ]);

      const [round] = structuredLogs(logSpy, 'plan_generation_round');
      expect(round).toMatchObject({ trigger: 'retry', outcome: 'failed', attempts: 4 });
      // 3 esperas entre los 4 intentos: 1 s + 2 s + 4 s
      expect(round.phases.find((item: any) => item.phase === 'backoff')).toMatchObject({
        count: 3,
        durationMs: 7000,
      });

      jest.useRealTimers();
    });

    it('si falla la carga de datos también deja el resumen de la ronda', async () => {
      orderLifecycle.findByIdWithUser.mockRejectedValue(new Error('db caída'));

      await service.execute({ orderId: 'order-1' });

      const [round] = structuredLogs(logSpy, 'plan_generation_round');
      expect(round).toMatchObject({ outcome: 'failed', attempts: 0, trigger: 'unknown' });
      expect(round.phases.find((item: any) => item.phase === 'load_data')).toBeDefined();
    });
  });
});
