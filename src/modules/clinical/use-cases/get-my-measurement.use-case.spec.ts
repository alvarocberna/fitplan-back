import { NotFoundException } from '@nestjs/common';
import { GetMyMeasurementUseCase } from './get-my-measurement.use-case';
import { CurrentUserResolver } from '../../identity/current-user.resolver';
import { MeasurementsRepository } from '../../../domain/repositories/clinical-domain/measurements.repository';
import type { CognitoUserClaims } from '../../../common/auth/cognito-user.decorator';

describe('GetMyMeasurementUseCase', () => {
  let useCase: GetMyMeasurementUseCase;
  let measurementsRepository: {
    getMeasurementDetailByIdAndPatientId: jest.Mock;
  };

  const claims: CognitoUserClaims = { sub: 'test-sub' };

  beforeEach(() => {
    const currentUser = {
      resolve: jest.fn().mockResolvedValue({ id: 'user-1' }),
    };
    measurementsRepository = {
      getMeasurementDetailByIdAndPatientId: jest.fn(),
    };
    useCase = new GetMyMeasurementUseCase(
      currentUser as unknown as CurrentUserResolver,
      measurementsRepository as unknown as MeasurementsRepository,
    );
  });

  it('arma el detalle con los valores crudos presentes y los resultados guardados', async () => {
    measurementsRepository.getMeasurementDetailByIdAndPatientId.mockResolvedValue(
      {
        id: 'm-1',
        measurementNumber: 1,
        measuredAt: new Date('2026-03-15T12:00:00.000Z'),
        level: 'ISAK_1',
        consultationId: 'c-1',
        consultation: { consultationNumber: 3 },
        basicMeasurements: [
          {
            id: 'b-1',
            measurementsId: 'm-1',
            weight: 72,
            height: 172,
            sittingHeight: null,
            armSpan: 175,
          },
        ],
        skinfolds: [
          { id: 's-1', measurementsId: 'm-1', triceps: 12, subscapular: null },
        ],
        circumferences: [{ id: 'c-1', measurementsId: 'm-1', waist: null }],
        diameters: [],
        measurementResults: [
          {
            bmi: 24.3,
            bmiClassification: 'NORMAL_WEIGHT',
            bfPercentage: 18,
            bfKg: null,
            bfClassification: null,
            bfMethod: 'BIOIMPEDANCE',
            mmPercentage: null,
            mmKg: 32,
            mmMethod: 'BIOIMPEDANCE',
            endo: 2.5,
            phaWeight: 1.1,
          },
        ],
      },
    );

    const detail = await useCase.execute({ claims, measurementId: 'm-1' });

    expect(
      measurementsRepository.getMeasurementDetailByIdAndPatientId,
    ).toHaveBeenCalledWith('m-1', 'user-1');
    expect(detail).toEqual({
      measurementId: 'm-1',
      measurementNumber: 1,
      measuredAt: '2026-03-15T12:00:00.000Z',
      level: 'ISAK_1',
      origin: 'CONSULTATION',
      consultationId: 'c-1',
      consultationNumber: 3,
      editable: true,
      raw: {
        basic: { weight: 72, height: 172, armSpan: 175 },
        skinfolds: { triceps: 12 },
        circumferences: null,
        diameters: null,
      },
      // solo los indicadores con valor; los pha_* se omiten
      results: [
        {
          indicator: 'BMI',
          value: 24.3,
          unit: 'kg/m²',
          classification: 'NORMAL_WEIGHT',
          method: null,
        },
        {
          indicator: 'BODY_FAT_PERCENTAGE',
          value: 18,
          unit: '%',
          classification: null,
          method: 'BIOIMPEDANCE',
        },
        {
          indicator: 'MUSCLE_MASS_KG',
          value: 32,
          unit: 'kg',
          classification: null,
          method: 'BIOIMPEDANCE',
        },
        {
          indicator: 'ENDOMORPHY',
          value: 2.5,
          unit: null,
          classification: null,
          method: null,
        },
      ],
    });
  });

  it('lanza 404 si la medición no existe o no es del usuario', async () => {
    measurementsRepository.getMeasurementDetailByIdAndPatientId.mockResolvedValue(
      null,
    );

    await expect(
      useCase.execute({ claims, measurementId: 'm-x' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
