import { ListMyMeasurementsUseCase } from './list-my-measurements.use-case';
import { CurrentUserResolver } from '../../identity/current-user.resolver';
import { MeasurementsRepository } from '../../../domain/repositories/clinical-domain/measurements.repository';
import type { CognitoUserClaims } from '../../../common/auth/cognito-user.decorator';

describe('ListMyMeasurementsUseCase', () => {
  let useCase: ListMyMeasurementsUseCase;
  let measurementsRepository: { listMeasurementsByPatientId: jest.Mock };

  const claims: CognitoUserClaims = { sub: 'test-sub' };

  beforeEach(() => {
    const currentUser = { resolve: jest.fn().mockResolvedValue({ id: 'user-1' }) };
    measurementsRepository = { listMeasurementsByPatientId: jest.fn() };
    useCase = new ListMyMeasurementsUseCase(
      currentUser as unknown as CurrentUserResolver,
      measurementsRepository as unknown as MeasurementsRepository,
    );
  });

  it('lista las mediciones del usuario del token (ambos orígenes) con peso, IMC y % guardados', async () => {
    measurementsRepository.listMeasurementsByPatientId.mockResolvedValue([
      {
        id: 'm-2',
        measurementNumber: 2,
        measuredAt: new Date('2026-05-10T12:00:00.000Z'),
        level: 'BIOIMPEDANCE',
        consultationId: null,
        basicMeasurements: [{ weight: 70, height: 172 }],
        measurementResults: [{ bmi: null, bmiClassification: null, bfPercentage: 18, mmPercentage: null }],
      },
      {
        id: 'm-1',
        measurementNumber: 1,
        measuredAt: new Date('2026-03-15T12:00:00.000Z'),
        level: 'BASIC',
        consultationId: 'c-1',
        consultation: { consultationNumber: 1 },
        basicMeasurements: [{ weight: 72, height: 172 }],
        measurementResults: [],
      },
    ]);
    const from = new Date('2026-01-01T00:00:00.000Z');

    const result = await useCase.execute({ claims, from });

    expect(measurementsRepository.listMeasurementsByPatientId).toHaveBeenCalledWith('user-1', {
      from,
      to: undefined,
    });
    expect(result).toEqual([
      {
        measurementId: 'm-2',
        measurementNumber: 2,
        measuredAt: '2026-05-10T12:00:00.000Z',
        level: 'BIOIMPEDANCE',
        origin: 'SELF_REPORTED',
        consultationId: null,
        consultationNumber: null,
        weight: 70,
        height: 172,
        bmi: null,
        bmiClassification: null,
        bfPercentage: 18,
        mmPercentage: null,
      },
      {
        measurementId: 'm-1',
        measurementNumber: 1,
        measuredAt: '2026-03-15T12:00:00.000Z',
        level: 'BASIC',
        origin: 'CONSULTATION',
        consultationId: 'c-1',
        consultationNumber: 1,
        weight: 72,
        height: 172,
        bmi: null,
        bmiClassification: null,
        bfPercentage: null,
        mmPercentage: null,
      },
    ]);
  });

  it('sin historial devuelve lista vacía', async () => {
    measurementsRepository.listMeasurementsByPatientId.mockResolvedValue([]);

    await expect(useCase.execute({ claims })).resolves.toEqual([]);
  });
});
