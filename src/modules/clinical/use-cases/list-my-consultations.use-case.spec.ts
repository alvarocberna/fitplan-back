import { Test, TestingModule } from '@nestjs/testing';
import { ListMyConsultationsUseCase } from './list-my-consultations.use-case';
import { CurrentUserResolver } from '../../identity/current-user.resolver';
import { NutritionalConsultationRepository } from '../../../domain/repositories/clinical-domain/nutritional-consultation.repository';
import type { CognitoUserClaims } from '../../../common/auth/cognito-user.decorator';

describe('ListMyConsultationsUseCase', () => {
  let useCase: ListMyConsultationsUseCase;
  let currentUser: jest.Mocked<CurrentUserResolver>;
  let nutritionalConsultationRepository: jest.Mocked<NutritionalConsultationRepository>;

  const claims: CognitoUserClaims = { sub: 'test-sub' };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ListMyConsultationsUseCase,
        { provide: CurrentUserResolver, useValue: { resolve: jest.fn() } },
        {
          provide: NutritionalConsultationRepository,
          useValue: {
            getNutritionalConsultationsWithStatusByPatientId: jest.fn(),
          },
        },
      ],
    }).compile();

    useCase = module.get(ListMyConsultationsUseCase);
    currentUser = module.get(CurrentUserResolver);
    nutritionalConsultationRepository = module.get(
      NutritionalConsultationRepository,
    );
    currentUser.resolve.mockResolvedValue({ id: 'user-1' } as any);
  });

  it('busca las consultas del usuario del token (R1) y las mapea en el orden del repositorio', async () => {
    nutritionalConsultationRepository.getNutritionalConsultationsWithStatusByPatientId.mockResolvedValue(
      [
        {
          id: 'c-2',
          consultationNumber: 2,
          consultationDate: new Date('2026-05-10T12:00:00.000Z'),
          orderId: 'order-2',
          order: {
            id: 'order-2',
            paymentStatus: 'PENDING',
            generationStatus: 'NOT_STARTED',
          },
          anamneses: [{ goals: [{ mainGoal: 'ganar masa muscular' }] }],
          plans: [],
        },
        {
          id: 'c-1',
          consultationNumber: 1,
          consultationDate: new Date('2026-03-15T12:00:00.000Z'),
          orderId: 'order-1',
          order: {
            id: 'order-1',
            paymentStatus: 'PAID',
            generationStatus: 'COMPLETED',
          },
          anamneses: [{ goals: [{ mainGoal: 'bajar de peso' }] }],
          plans: [
            {
              nutritionalPlans: [
                {
                  planName: 'Plan personalizado',
                  goal: 'definicion',
                  dietRegimen: 'Hipocalórico',
                  calorieIntake: 2000,
                  proteinIntake: 150,
                  carbohydrateIntake: 200,
                  lipidIntake: 60,
                },
              ],
            },
          ],
        },
      ] as any,
    );

    const result = await useCase.execute({ claims });

    expect(currentUser.resolve).toHaveBeenCalledWith(claims);
    expect(
      nutritionalConsultationRepository.getNutritionalConsultationsWithStatusByPatientId,
    ).toHaveBeenCalledWith('user-1');
    expect(result).toEqual([
      {
        consultationId: 'c-2',
        consultationNumber: 2,
        consultationDate: '2026-05-10T12:00:00.000Z',
        mainGoal: 'ganar masa muscular',
        planStatus: 'awaiting_payment',
        orderId: 'order-2',
        plan: null,
      },
      {
        consultationId: 'c-1',
        consultationNumber: 1,
        consultationDate: '2026-03-15T12:00:00.000Z',
        mainGoal: 'bajar de peso',
        planStatus: 'ready',
        orderId: 'order-1',
        plan: {
          planName: 'Plan personalizado',
          goal: 'definicion',
          dietRegimen: 'Hipocalórico',
          calorieIntake: 2000,
          proteinIntake: 150,
          carbohydrateIntake: 200,
          lipidIntake: 60,
        },
      },
    ]);
  });

  it('devuelve lista vacía (no 404) si el usuario no tiene consultas', async () => {
    nutritionalConsultationRepository.getNutritionalConsultationsWithStatusByPatientId.mockResolvedValue(
      [],
    );

    await expect(useCase.execute({ claims })).resolves.toEqual([]);
  });

  it('deja mainGoal, planStatus y plan en null si la consulta no tiene anamnesis, orden ni plan', async () => {
    nutritionalConsultationRepository.getNutritionalConsultationsWithStatusByPatientId.mockResolvedValue(
      [
        {
          id: 'c-1',
          consultationNumber: 1,
          consultationDate: new Date('2026-03-15T12:00:00.000Z'),
          orderId: null,
          order: null,
        },
      ] as any,
    );

    const [item] = await useCase.execute({ claims });

    expect(item.mainGoal).toBeNull();
    expect(item.planStatus).toBeNull();
    expect(item.orderId).toBeNull();
    expect(item.plan).toBeNull();
  });
});
