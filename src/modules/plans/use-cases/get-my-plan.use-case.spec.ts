import { NotFoundException } from '@nestjs/common';
import { GetMyPlanUseCase } from './get-my-plan.use-case';
import { CurrentUserResolver } from '../../identity/current-user.resolver';
import { OrderRepository } from '../../../domain/repositories/commercial-domain/order.repository';
import { FileStorage } from '../../../domain/ports';
import type { CognitoUserClaims } from '../../../common/auth/cognito-user.decorator';

describe('GetMyPlanUseCase', () => {
  let useCase: GetMyPlanUseCase;
  let orderRepository: { getReadyOrderWithPlanDetailByIdAndUserId: jest.Mock };
  let fileStorage: { getSignedDownloadUrl: jest.Mock };

  const claims: CognitoUserClaims = { sub: 'test-sub' };
  const creationDate = new Date('2026-01-01T00:00:00.000Z');
  const paymentDate = new Date('2026-01-02T10:00:00.000Z');

  const nutritionalPlanRow = {
    planName: 'Plan personalizado',
    period: null,
    startDate: new Date('2026-01-02T00:00:00.000Z'),
    endDate: null,
    goal: 'definicion',
    dietRegimen: 'Hipocalórico',
    calorieRequirement: 2100,
    proteinRequirement: 160,
    carbohydrateRequirement: 210,
    lipidRequirement: 65,
    calorieIntake: 2000,
    proteinIntake: 150,
    carbohydrateIntake: 200,
    lipidIntake: 60,
  };

  const baseOrder = {
    id: 'order-1',
    creationDate,
    paymentDate,
    pdfKey: 'productos-personalizados/order-1.pdf',
    thumbnailKey: 'productos-personalizados/miniaturas/order-1.webp',
    planJson: null as string | null,
    product: {
      type: 'GENERATED',
      name: 'Plan Nutricional Personalizado',
      description: 'Plan generado',
    },
  };

  beforeEach(() => {
    const currentUser = { resolve: jest.fn().mockResolvedValue({ id: 'user-1' }) };
    orderRepository = { getReadyOrderWithPlanDetailByIdAndUserId: jest.fn() };
    fileStorage = {
      getSignedDownloadUrl: jest.fn(async (key: string) => `https://signed-url.example/${key}`),
    };
    useCase = new GetMyPlanUseCase(
      currentUser as unknown as CurrentUserResolver,
      orderRepository as unknown as OrderRepository,
      fileStorage as unknown as FileStorage,
    );
  });

  it('arma el detalle del plan personalizado desde el NutritionalPlan y sus tablas hijas', async () => {
    orderRepository.getReadyOrderWithPlanDetailByIdAndUserId.mockResolvedValue({
      ...baseOrder,
      plan: {
        consultationId: 'c-1',
        nutritionalPlans: [
          {
            ...nutritionalPlanRow,
            mealTimes: [
              {
                time: 'BREAKFAST',
                hour: '8am',
                calorieIntake: 400,
                proteinIntake: 20,
                carbohydrateIntake: 50,
                fatIntake: 10,
                cereal: 2,
                fruit: null,
                lowFatDairy: 1,
                sugar: 0,
                notes: [
                  { note: 'Pan con quesillo', type: 'EXAMPLE' },
                  { note: 'Preferir pan integral', type: 'COMMENT' },
                  { note: 'cereals: avena 1 taza', type: 'EQUIVALENCE' },
                ],
              },
            ],
            supplements: [
              {
                supplement: 'Creatina',
                requirement: 5,
                doseInstructions: '5 g al día',
                intakeInstructions: 'Con el desayuno',
                calorieIntake: 0,
                proteinIntake: 0,
                carbohydrateIntake: 0,
                fatIntake: 0,
                notes: [
                  { note: 'Mejora la fuerza', type: 'EFFECT' },
                  { note: 'Hidratarse bien', type: 'CONSIDERATION' },
                ],
              },
            ],
            sportsRecommendations: [
              {
                session: 'Pesas',
                strategy: 'Carga de carbohidratos',
                preActivity: 'Plátano',
                duringActivity: null,
                postActivity: 'Batido',
              },
            ],
          },
        ],
      },
    });

    const detail = await useCase.execute({ claims, orderId: 'order-1' });

    expect(orderRepository.getReadyOrderWithPlanDetailByIdAndUserId).toHaveBeenCalledWith(
      'order-1',
      'user-1',
    );
    expect(detail).toEqual({
      orderId: 'order-1',
      type: 'GENERATED',
      name: 'Plan personalizado',
      purchasedAt: '2026-01-02T10:00:00.000Z',
      pdfUrl: 'https://signed-url.example/productos-personalizados/order-1.pdf',
      thumbnailUrl: 'https://signed-url.example/productos-personalizados/miniaturas/order-1.webp',
      predefined: null,
      generated: {
        consultationId: 'c-1',
        planName: 'Plan personalizado',
        period: null,
        startDate: '2026-01-02T00:00:00.000Z',
        endDate: null,
        goal: 'definicion',
        dietRegimen: 'Hipocalórico',
        requirements: { calories: 2100, protein: 160, carbohydrate: 210, fat: 65 },
        intake: { calories: 2000, protein: 150, carbohydrate: 200, fat: 60 },
        mealTimes: [
          {
            time: 'BREAKFAST',
            hour: '8am',
            intake: { calories: 400, protein: 20, carbohydrate: 50, fat: 10 },
            // solo los grupos con porciones > 0
            portions: { cereal: 2, lowFatDairy: 1 },
            examples: ['Pan con quesillo'],
            comments: ['Preferir pan integral'],
            equivalences: ['cereals: avena 1 taza'],
          },
        ],
        supplements: [
          {
            supplement: 'Creatina',
            requirement: 5,
            doseInstructions: '5 g al día',
            intakeInstructions: 'Con el desayuno',
            intake: { calories: 0, protein: 0, carbohydrate: 0, fat: 0 },
            effects: ['Mejora la fuerza'],
            considerations: ['Hidratarse bien'],
          },
        ],
        sportsRecommendations: [
          {
            session: 'Pesas',
            strategy: 'Carga de carbohidratos',
            preActivity: 'Plátano',
            duringActivity: null,
            postActivity: 'Batido',
          },
        ],
      },
    });
  });

  it('cae a order.planJson cuando el NutritionalPlan no tiene tablas hijas (planes anteriores)', async () => {
    const planJson = {
      prescription: { regimen: 'Hipocalórico', goal: 'definicion', calories: 2100, protein: 160, carbohydrate: 210, fat: 65 },
      planIntake: {
        adequacy: { calories: 95, protein: 94, carbohydrate: 95, fat: 92 },
        totalIntake: { calories: 2000, protein: 150, carbohydrate: 200, fat: 60 },
      },
      mealTimes: [
        {
          description: { time: 'almuerzo', hour: '13:00' },
          intake: { calories: 700, protein: 40, carbohydrate: 80, fat: 20 },
          foods: {},
          examples: ['Arroz con pollo'],
          comments: [],
        },
      ],
      supplements: [],
      sportsRecommendations: [],
    };
    orderRepository.getReadyOrderWithPlanDetailByIdAndUserId.mockResolvedValue({
      ...baseOrder,
      planJson: JSON.stringify(planJson),
      plan: {
        consultationId: 'c-1',
        nutritionalPlans: [{ ...nutritionalPlanRow, mealTimes: [], supplements: [], sportsRecommendations: [] }],
      },
    });

    const { generated } = await useCase.execute({ claims, orderId: 'order-1' });

    expect(generated).toMatchObject({
      consultationId: 'c-1',
      planName: 'Plan personalizado',
      // las fechas reales salen de la fila NutritionalPlan
      startDate: '2026-01-02T00:00:00.000Z',
      mealTimes: [
        {
          time: 'LUNCH',
          hour: '13:00',
          intake: { calories: 700, protein: 40, carbohydrate: 80, fat: 20 },
          portions: {},
          examples: ['Arroz con pollo'],
        },
      ],
    });
  });

  it('con un planJson ilegible muestra lo que haya en la fila principal, sin fallar', async () => {
    orderRepository.getReadyOrderWithPlanDetailByIdAndUserId.mockResolvedValue({
      ...baseOrder,
      planJson: '{"formato":"antiguo"}',
      plan: { consultationId: 'c-1', nutritionalPlans: [{ ...nutritionalPlanRow }] },
    });

    const { generated } = await useCase.execute({ claims, orderId: 'order-1' });

    expect(generated).toMatchObject({ planName: 'Plan personalizado', mealTimes: [], supplements: [] });
  });

  it('arma el detalle del plan estándar desde el producto', async () => {
    orderRepository.getReadyOrderWithPlanDetailByIdAndUserId.mockResolvedValue({
      ...baseOrder,
      thumbnailKey: null,
      product: {
        type: 'PREDEFINED',
        name: 'Plan Running',
        description: 'Plan para corredores',
        goal: 'mantencion',
        dietRegimen: null,
        calorieIntake: null,
        proteinIntake: null,
        carbohydrateIntake: null,
        lipidIntake: null,
      },
      plan: null,
    });

    const detail = await useCase.execute({ claims, orderId: 'order-1' });

    expect(detail).toMatchObject({
      type: 'PREDEFINED',
      name: 'Plan Running',
      thumbnailUrl: null,
      generated: null,
      predefined: {
        description: 'Plan para corredores',
        summary: {
          goal: 'mantencion',
          dietRegimen: null,
          calorieIntake: null,
          proteinIntake: null,
          carbohydrateIntake: null,
          lipidIntake: null,
        },
      },
    });
  });

  it('lanza 404 si la orden no existe, no es del usuario o no está lista', async () => {
    orderRepository.getReadyOrderWithPlanDetailByIdAndUserId.mockResolvedValue(null);

    await expect(useCase.execute({ claims, orderId: 'order-x' })).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(fileStorage.getSignedDownloadUrl).not.toHaveBeenCalled();
  });
});
