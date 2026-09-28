import { BadRequestException } from '@nestjs/common';
import { RecordMeasurementUseCase } from './record-measurement.use-case';
import { CurrentUserResolver } from '../../identity/current-user.resolver';
import { ClinicalRecordRepository } from '../../../domain/repositories/clinical-domain/clinical-record.repository';
import { MeasurementsRepository } from '../../../domain/repositories/clinical-domain/measurements.repository';
import type { CognitoUserClaims } from '../../../common/auth/cognito-user.decorator';
import type { RecordMeasurementDtoImpl } from '../dto/measurement.dto';

describe('RecordMeasurementUseCase', () => {
  let useCase: RecordMeasurementUseCase;
  let clinicalRecordRepository: { findOrCreateClinicalRecordByPatientId: jest.Mock };
  let measurementsRepository: {
    getMaxMeasurementNumberByClinicalRecordId: jest.Mock;
    createMeasurementWithDetails: jest.Mock;
    getMeasurementDetailByIdAndPatientId: jest.Mock;
  };

  const claims: CognitoUserClaims = { sub: 'test-sub' };

  beforeEach(() => {
    const currentUser = { resolve: jest.fn().mockResolvedValue({ id: 'user-1' }) };
    clinicalRecordRepository = {
      findOrCreateClinicalRecordByPatientId: jest.fn().mockResolvedValue({ id: 'cr-1' }),
    };
    measurementsRepository = {
      getMaxMeasurementNumberByClinicalRecordId: jest.fn().mockResolvedValue(2),
      createMeasurementWithDetails: jest.fn().mockResolvedValue({ id: 'm-new' }),
      getMeasurementDetailByIdAndPatientId: jest.fn().mockResolvedValue({
        id: 'm-new',
        measurementNumber: 3,
        measuredAt: new Date('2026-05-10T12:00:00.000Z'),
        level: 'BASIC',
        consultationId: null,
        basicMeasurements: [{ weight: 70, height: 172 }],
        measurementResults: [],
      }),
    };
    useCase = new RecordMeasurementUseCase(
      currentUser as unknown as CurrentUserResolver,
      clinicalRecordRepository as unknown as ClinicalRecordRepository,
      measurementsRepository as unknown as MeasurementsRepository,
    );
  });

  const basic: RecordMeasurementDtoImpl = {
    level: 'BASIC',
    measuredAt: '2026-05-10T12:00:00.000Z',
    weight: 70,
    height: 172,
  };

  it('registra una medición básica en el historial del usuario (lo crea si no existe) con el siguiente número y sin resultados', async () => {
    const detail = await useCase.execute({ claims, data: basic });

    expect(clinicalRecordRepository.findOrCreateClinicalRecordByPatientId).toHaveBeenCalledWith('user-1');
    expect(measurementsRepository.getMaxMeasurementNumberByClinicalRecordId).toHaveBeenCalledWith('cr-1');
    expect(measurementsRepository.createMeasurementWithDetails).toHaveBeenCalledWith({
      clinicalRecordId: 'cr-1',
      measuredAt: new Date('2026-05-10T12:00:00.000Z'),
      level: 'BASIC',
      measurementNumber: 3,
      basic: { weight: 70, height: 172 },
      results: null,
    });
    // R6: devuelve lo creado, releído con sus hijas
    expect(measurementsRepository.getMeasurementDetailByIdAndPatientId).toHaveBeenCalledWith('m-new', 'user-1');
    expect(detail).toMatchObject({ measurementId: 'm-new', origin: 'SELF_REPORTED', editable: true });
  });

  it('usa la fecha actual si no se envía measuredAt', async () => {
    const before = Date.now();

    await useCase.execute({ claims, data: { ...basic, measuredAt: undefined } });

    const { measuredAt } = measurementsRepository.createMeasurementWithDetails.mock.calls[0][0];
    expect(measuredAt.getTime()).toBeGreaterThanOrEqual(before);
  });

  it('en bioimpedancia guarda la grasa y la masa muscular tal como se ingresaron, con método BIOIMPEDANCE', async () => {
    await useCase.execute({
      claims,
      data: {
        ...basic,
        level: 'BIOIMPEDANCE',
        bodyFat: { value: 18, unit: 'PERCENTAGE' },
        muscleMass: { value: 32, unit: 'KG' },
      },
    });

    expect(measurementsRepository.createMeasurementWithDetails.mock.calls[0][0].results).toEqual({
      bfPercentage: 18,
      bfKg: null,
      bfMethod: 'BIOIMPEDANCE',
      mmPercentage: null,
      mmKg: 32,
      mmMethod: 'BIOIMPEDANCE',
    });
  });

  it.each([
    ['una fecha futura', { ...basic, measuredAt: '2999-01-01T00:00:00.000Z' }],
    ['bioimpedancia sin masa muscular', { ...basic, level: 'BIOIMPEDANCE', bodyFat: { value: 18, unit: 'PERCENTAGE' } }],
    ['grasa corporal en una medición básica', { ...basic, bodyFat: { value: 18, unit: 'PERCENTAGE' } }],
    [
      'un % fuera de rango',
      { ...basic, level: 'BIOIMPEDANCE', bodyFat: { value: 90, unit: 'PERCENTAGE' }, muscleMass: { value: 30, unit: 'KG' } },
    ],
    [
      'kg mayores que el peso',
      { ...basic, level: 'BIOIMPEDANCE', bodyFat: { value: 18, unit: 'PERCENTAGE' }, muscleMass: { value: 80, unit: 'KG' } },
    ],
  ])('rechaza con 400 %s, sin escribir nada', async (_, data) => {
    await expect(
      useCase.execute({ claims, data: data as RecordMeasurementDtoImpl }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(measurementsRepository.createMeasurementWithDetails).not.toHaveBeenCalled();
  });
});
