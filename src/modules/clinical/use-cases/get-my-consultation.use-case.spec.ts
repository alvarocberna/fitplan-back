import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { GetMyConsultationUseCase } from './get-my-consultation.use-case';
import { CurrentUserResolver } from '../../identity/current-user.resolver';
import { NutritionalConsultationRepository } from '../../../domain/repositories/clinical-domain/nutritional-consultation.repository';
import { FileStorage } from '../../../domain/ports';
import type { CognitoUserClaims } from '../../../common/auth/cognito-user.decorator';

describe('GetMyConsultationUseCase', () => {
  let useCase: GetMyConsultationUseCase;
  let currentUser: jest.Mocked<CurrentUserResolver>;
  let nutritionalConsultationRepository: jest.Mocked<NutritionalConsultationRepository>;
  let fileStorage: { getSignedDownloadUrl: jest.Mock };

  const claims: CognitoUserClaims = { sub: 'test-sub' };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GetMyConsultationUseCase,
        { provide: CurrentUserResolver, useValue: { resolve: jest.fn() } },
        {
          provide: NutritionalConsultationRepository,
          useValue: {
            getNutritionalConsultationDetailByIdAndPatientId: jest.fn(),
          },
        },
        {
          provide: FileStorage,
          useValue: { getSignedDownloadUrl: jest.fn() },
        },
      ],
    }).compile();

    useCase = module.get(GetMyConsultationUseCase);
    currentUser = module.get(CurrentUserResolver);
    nutritionalConsultationRepository = module.get(
      NutritionalConsultationRepository,
    );
    fileStorage = module.get(FileStorage);
    currentUser.resolve.mockResolvedValue({ id: 'user-1' } as any);
  });

  it('busca la consulta por id y por el usuario del token (R1 + R2) y arma el detalle', async () => {
    nutritionalConsultationRepository.getNutritionalConsultationDetailByIdAndPatientId.mockResolvedValue(
      {
        id: 'c-1',
        consultationNumber: 1,
        consultationDate: new Date('2026-03-15T12:00:00.000Z'),
        orderId: 'order-1',
        order: {
          id: 'order-1',
          paymentStatus: 'PAID',
          generationStatus: 'COMPLETED',
          pdfKey: 'productos-personalizados/order-1.pdf',
          creationDate: new Date('2026-03-15T12:00:00.000Z'),
        },
        anamneses: [
          {
            goals: [
              {
                mainGoal: 'bajar de peso',
                secondaryGoal: ['dormir mejor', 'más energía'],
              },
            ],
          },
        ],
        measurements: [
          {
            id: 'm-1',
            measurementNumber: 1,
            measuredAt: new Date('2026-03-15T12:00:00.000Z'),
            level: 'BASIC',
            basicMeasurements: [
              { weight: 70.5, height: 172, sittingHeight: null, armSpan: null },
            ],
            measurementResults: [
              {
                bmi: 23.8,
                bmiClassification: 'NORMAL_WEIGHT',
                bfPercentage: null,
                bfClassification: null,
              },
            ],
          },
        ],
        plans: [
          {
            orderId: 'order-1',
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
      } as any,
    );

    fileStorage.getSignedDownloadUrl.mockResolvedValue(
      'https://signed.example/order-1.pdf',
    );

    const result = await useCase.execute({ claims, consultationId: 'c-1' });

    expect(currentUser.resolve).toHaveBeenCalledWith(claims);
    // R4: el PDF se firma como descarga (attachment), nunca se expone la key
    expect(fileStorage.getSignedDownloadUrl).toHaveBeenCalledTimes(1);
    expect(fileStorage.getSignedDownloadUrl).toHaveBeenCalledWith(
      'productos-personalizados/order-1.pdf',
      undefined,
      { downloadFilename: 'plan-nutricional-2026-03-15.pdf' },
    );
    expect(
      nutritionalConsultationRepository.getNutritionalConsultationDetailByIdAndPatientId,
    ).toHaveBeenCalledWith('c-1', 'user-1');
    expect(result).toEqual({
      consultationId: 'c-1',
      consultationNumber: 1,
      consultationDate: '2026-03-15T12:00:00.000Z',
      goals: {
        mainGoal: 'bajar de peso',
        secondaryGoals: ['dormir mejor', 'más energía'],
      },
      planStatus: 'ready',
      orderId: 'order-1',
      measurements: [
        {
          measurementId: 'm-1',
          measurementNumber: 1,
          measuredAt: '2026-03-15T12:00:00.000Z',
          level: 'BASIC',
          basic: { weight: 70.5, height: 172, sittingHeight: null, armSpan: null },
          results: {
            bmi: 23.8,
            bmiClassification: 'NORMAL_WEIGHT',
            bfPercentage: null,
            bfClassification: null,
          },
        },
      ],
      plan: {
        orderId: 'order-1',
        pdfUrl: 'https://signed.example/order-1.pdf',
        planName: 'Plan personalizado',
        goal: 'definicion',
        dietRegimen: 'Hipocalórico',
        calorieIntake: 2000,
        proteinIntake: 150,
        carbohydrateIntake: 200,
        lipidIntake: 60,
      },
    });
  });

  it('lanza 404 si la consulta no existe o no es del usuario', async () => {
    nutritionalConsultationRepository.getNutritionalConsultationDetailByIdAndPatientId.mockResolvedValue(
      null,
    );

    await expect(
      useCase.execute({ claims, consultationId: 'c-ajena' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('devuelve objetivos vacíos, sin mediciones ni plan, si la consulta todavía no los tiene', async () => {
    nutritionalConsultationRepository.getNutritionalConsultationDetailByIdAndPatientId.mockResolvedValue(
      {
        id: 'c-2',
        consultationNumber: 2,
        consultationDate: new Date('2026-05-10T12:00:00.000Z'),
        orderId: 'order-2',
        order: {
          id: 'order-2',
          paymentStatus: 'PENDING',
          generationStatus: 'NOT_STARTED',
          pdfKey: null,
          creationDate: new Date('2026-05-10T12:00:00.000Z'),
        },
        anamneses: [],
        measurements: [
          {
            id: 'm-2',
            measurementNumber: 1,
            measuredAt: new Date('2026-05-10T12:00:00.000Z'),
            level: null,
            basicMeasurements: [],
            measurementResults: [],
          },
        ],
        plans: [],
      } as any,
    );

    const result = await useCase.execute({ claims, consultationId: 'c-2' });

    expect(result.goals).toEqual({ mainGoal: null, secondaryGoals: [] });
    expect(result.planStatus).toBe('awaiting_payment');
    expect(result.measurements[0].basic).toBeNull();
    expect(result.measurements[0].results).toBeNull();
    expect(result.plan).toBeNull();
    expect(fileStorage.getSignedDownloadUrl).not.toHaveBeenCalled();
  });
});
