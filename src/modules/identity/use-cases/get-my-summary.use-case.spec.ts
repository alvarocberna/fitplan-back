import { Test, TestingModule } from '@nestjs/testing';
import { GetMySummaryUseCase } from './get-my-summary.use-case';
import { CurrentUserResolver } from '../current-user.resolver';
import { NutritionalConsultationRepository } from '../../../domain/repositories/clinical-domain/nutritional-consultation.repository';
import { MeasurementsRepository } from '../../../domain/repositories/clinical-domain/measurements.repository';
import { calculateAge } from '../../../domain';
import type { CognitoUserClaims } from '../../../common/auth/cognito-user.decorator';

describe('GetMySummaryUseCase', () => {
  let service: GetMySummaryUseCase;
  let currentUser: jest.Mocked<CurrentUserResolver>;
  let nutritionalConsultationRepository: jest.Mocked<NutritionalConsultationRepository>;
  let measurementsRepository: jest.Mocked<MeasurementsRepository>;

  const cognitoUser: CognitoUserClaims = { sub: 'test-sub' };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GetMySummaryUseCase,
        { provide: CurrentUserResolver, useValue: { resolve: jest.fn() } },
        {
          provide: NutritionalConsultationRepository,
          useValue: {
            getLatestNutritionalConsultationWithDetailsByPatientId: jest.fn(),
          },
        },
        {
          provide: MeasurementsRepository,
          useValue: {
            getLatestMeasurementsWithResultsByPatientId: jest
              .fn()
              .mockResolvedValue(null),
          },
        },
      ],
    }).compile();

    service = module.get(GetMySummaryUseCase);
    currentUser = module.get(CurrentUserResolver);
    nutritionalConsultationRepository = module.get(
      NutritionalConsultationRepository,
    );
    measurementsRepository = module.get(MeasurementsRepository);
  });

  describe('execute', () => {
    it('arma el resumen con nombre completo, edad, fecha de consulta, objetivo y plan cuando hay una consulta con goals y un plan activo con su nutritionalPlan principal', async () => {
      const dateOfBirth = new Date('1995-01-01');
      currentUser.resolve.mockResolvedValue({
        id: 'user-1',
        firstName: 'Ana',
        middleName: 'María',
        paternalLastName: 'Pérez',
        maternalLastName: 'Soto',
        dateOfBirth,
      } as any);
      nutritionalConsultationRepository.getLatestNutritionalConsultationWithDetailsByPatientId.mockResolvedValue(
        {
          consultationDate: new Date('2026-03-15T12:00:00.000Z'),
          anamneses: [{ goals: [{ mainGoal: 'bajar de peso' }] }],
          plans: [
            {
              active: true,
              nutritionalPlans: [
                {
                  mainPlan: true,
                  dietRegimen: 'Régimen hipocalórico hiperproteico.',
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

      const result = await service.execute({ claims: cognitoUser });

      expect(currentUser.resolve).toHaveBeenCalledWith(cognitoUser);
      expect(
        nutritionalConsultationRepository.getLatestNutritionalConsultationWithDetailsByPatientId,
      ).toHaveBeenCalledWith('user-1');
      expect(result).toEqual({
        firstName: 'Ana',
        middleName: 'María',
        paternalLastName: 'Pérez',
        maternalLastName: 'Soto',
        age: calculateAge(dateOfBirth),
        lastConsultationDate: '2026-03-15T12:00:00.000Z',
        goal: 'bajar de peso',
        nutritionalPlan: {
          dietRegimen: 'Régimen hipocalórico hiperproteico.',
          calorieIntake: 2000,
          proteinIntake: 150,
          carbohydrateIntake: 200,
          lipidIntake: 60,
        },
        lastMeasurement: null,
      });
    });

    it('devuelve age null si el usuario no tiene dateOfBirth cargado, sin lanzar', async () => {
      currentUser.resolve.mockResolvedValue({
        id: 'user-1',
        firstName: 'Ana',
        paternalLastName: 'Pérez',
        dateOfBirth: null,
      } as any);
      nutritionalConsultationRepository.getLatestNutritionalConsultationWithDetailsByPatientId.mockResolvedValue(
        {
          anamneses: [{ goals: [{ mainGoal: 'bajar de peso' }] }],
          plans: [{ active: true, nutritionalPlans: [] }],
        } as any,
      );

      const result = await service.execute({ claims: cognitoUser });

      expect(result.age).toBeNull();
    });

    it('devuelve goal y nutritionalPlan null (sin lanzar) si el paciente todavía no tiene ninguna consulta', async () => {
      currentUser.resolve.mockResolvedValue({
        id: 'user-1',
        firstName: 'Ana',
        middleName: null,
        paternalLastName: 'Pérez',
        maternalLastName: null,
        dateOfBirth: null,
      } as any);
      nutritionalConsultationRepository.getLatestNutritionalConsultationWithDetailsByPatientId.mockResolvedValue(
        null,
      );

      const result = await service.execute({ claims: cognitoUser });

      expect(result).toEqual({
        firstName: 'Ana',
        middleName: null,
        paternalLastName: 'Pérez',
        maternalLastName: null,
        age: null,
        lastConsultationDate: null,
        goal: null,
        nutritionalPlan: null,
        lastMeasurement: null,
      });
    });

    it('devuelve goal y nutritionalPlan null si la consulta existe pero sin anamneses/plans asociados', async () => {
      currentUser.resolve.mockResolvedValue({
        id: 'user-1',
        firstName: 'Ana',
        paternalLastName: 'Pérez',
        dateOfBirth: null,
      } as any);
      nutritionalConsultationRepository.getLatestNutritionalConsultationWithDetailsByPatientId.mockResolvedValue(
        { anamneses: [], plans: [] } as any,
      );

      const result = await service.execute({ claims: cognitoUser });

      expect(result.goal).toBeNull();
      expect(result.nutritionalPlan).toBeNull();
    });

    it('incluye la última medición del historial con peso, talla y los resultados guardados', async () => {
      currentUser.resolve.mockResolvedValue({
        id: 'user-1',
        dateOfBirth: null,
      } as any);
      nutritionalConsultationRepository.getLatestNutritionalConsultationWithDetailsByPatientId.mockResolvedValue(
        null,
      );
      measurementsRepository.getLatestMeasurementsWithResultsByPatientId.mockResolvedValue(
        {
          measuredAt: new Date('2026-04-01T10:00:00.000Z'),
          basicMeasurements: [{ weight: 70.5, height: 172 }],
          measurementResults: [
            {
              bmi: 23.8,
              bmiClassification: 'NORMAL_WEIGHT',
              bfPercentage: 18.2,
            },
          ],
        } as any,
      );

      const result = await service.execute({ claims: cognitoUser });

      expect(
        measurementsRepository.getLatestMeasurementsWithResultsByPatientId,
      ).toHaveBeenCalledWith('user-1');
      expect(result.lastMeasurement).toEqual({
        measuredAt: '2026-04-01T10:00:00.000Z',
        weight: 70.5,
        height: 172,
        bmi: 23.8,
        bmiClassification: 'NORMAL_WEIGHT',
        bfPercentage: 18.2,
      });
    });

    it('deja bmi, clasificación y % grasa en null si la medición no tiene measurement_results (no los calcula)', async () => {
      currentUser.resolve.mockResolvedValue({
        id: 'user-1',
        dateOfBirth: null,
      } as any);
      nutritionalConsultationRepository.getLatestNutritionalConsultationWithDetailsByPatientId.mockResolvedValue(
        null,
      );
      measurementsRepository.getLatestMeasurementsWithResultsByPatientId.mockResolvedValue(
        {
          measuredAt: new Date('2026-04-01T10:00:00.000Z'),
          basicMeasurements: [{ weight: 70.5, height: 172 }],
          measurementResults: [],
        } as any,
      );

      const result = await service.execute({ claims: cognitoUser });

      expect(result.lastMeasurement).toEqual({
        measuredAt: '2026-04-01T10:00:00.000Z',
        weight: 70.5,
        height: 172,
        bmi: null,
        bmiClassification: null,
        bfPercentage: null,
      });
    });
  });
});
