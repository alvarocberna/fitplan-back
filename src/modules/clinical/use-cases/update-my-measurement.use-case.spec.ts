import { BadRequestException, NotFoundException } from '@nestjs/common';
import { UpdateMyMeasurementUseCase } from './update-my-measurement.use-case';
import { CurrentUserResolver } from '../../identity/current-user.resolver';
import { MeasurementsRepository } from '../../../domain/repositories/clinical-domain/measurements.repository';
import type { CognitoUserClaims } from '../../../common/auth/cognito-user.decorator';

describe('UpdateMyMeasurementUseCase', () => {
  let useCase: UpdateMyMeasurementUseCase;
  let measurementsRepository: {
    getMeasurementDetailByIdAndPatientId: jest.Mock;
    updateMeasurementWithDetails: jest.Mock;
  };

  const claims: CognitoUserClaims = { sub: 'test-sub' };

  const basicMeasurement = {
    id: 'm-1',
    measurementNumber: 1,
    measuredAt: new Date('2026-03-15T12:00:00.000Z'),
    level: 'BASIC',
    // de una consulta: también se puede editar
    consultationId: 'c-1',
    basicMeasurements: [{ weight: 72, height: 172 }],
    measurementResults: [],
  };

  const bioimpedance = {
    ...basicMeasurement,
    id: 'm-2',
    level: 'BIOIMPEDANCE',
    consultationId: null,
    measurementResults: [{ bfPercentage: 18, bfKg: null, mmPercentage: null, mmKg: 32 }],
  };

  beforeEach(() => {
    const currentUser = { resolve: jest.fn().mockResolvedValue({ id: 'user-1' }) };
    measurementsRepository = {
      getMeasurementDetailByIdAndPatientId: jest.fn(),
      updateMeasurementWithDetails: jest.fn(),
    };
    useCase = new UpdateMyMeasurementUseCase(
      currentUser as unknown as CurrentUserResolver,
      measurementsRepository as unknown as MeasurementsRepository,
    );
  });

  it('corrige peso y fecha de una medición de consulta, recalcula su IMC y devuelve el detalle actualizado', async () => {
    measurementsRepository.getMeasurementDetailByIdAndPatientId
      .mockResolvedValueOnce(basicMeasurement)
      .mockResolvedValueOnce({ ...basicMeasurement, basicMeasurements: [{ weight: 70, height: 172 }] });

    const detail = await useCase.execute({
      claims,
      measurementId: 'm-1',
      data: { weight: 70, measuredAt: '2026-03-14T12:00:00.000Z' },
    });

    expect(measurementsRepository.getMeasurementDetailByIdAndPatientId).toHaveBeenCalledWith('m-1', 'user-1');
    expect(measurementsRepository.updateMeasurementWithDetails).toHaveBeenCalledWith('m-1', {
      measuredAt: new Date('2026-03-14T12:00:00.000Z'),
      basic: { weight: 70 },
      results: { bmi: 23.66, bmiClassification: 'NORMAL_WEIGHT' },
    });
    expect(detail.raw.basic).toEqual({ weight: 70, height: 172 });
  });

  it('solo con la fecha no recalcula los resultados', async () => {
    measurementsRepository.getMeasurementDetailByIdAndPatientId.mockResolvedValue(basicMeasurement);

    await useCase.execute({
      claims,
      measurementId: 'm-1',
      data: { measuredAt: '2026-03-14T12:00:00.000Z' },
    });

    expect(measurementsRepository.updateMeasurementWithDetails).toHaveBeenCalledWith(
      'm-1',
      expect.objectContaining({ results: undefined }),
    );
  });

  it('en una bioimpedancia reemplaza la grasa enviada y recalcula todo con lo guardado', async () => {
    measurementsRepository.getMeasurementDetailByIdAndPatientId.mockResolvedValue(bioimpedance);

    await useCase.execute({
      claims,
      measurementId: 'm-2',
      data: { bodyFat: { value: 12, unit: 'KG' } },
    });

    expect(measurementsRepository.updateMeasurementWithDetails).toHaveBeenCalledWith('m-2', {
      measuredAt: undefined,
      basic: undefined,
      results: {
        bmi: 24.34,
        bmiClassification: 'NORMAL_WEIGHT',
        bfKg: 12,
        bfPercentage: 16.67,
        bfMethod: 'BIOIMPEDANCE',
        mmKg: 32,
        mmPercentage: 44.44,
        mmMethod: 'BIOIMPEDANCE',
        vfKg: null,
        vfPercentage: null,
        vfMethod: null,
        bmKg: null,
        bmPercentage: null,
        bmMethod: null,
      },
    });
  });

  it('en una bioimpedancia, si cambia solo el peso mantiene los % y recalcula los kg y el IMC', async () => {
    measurementsRepository.getMeasurementDetailByIdAndPatientId.mockResolvedValue({
      ...bioimpedance,
      measurementResults: [
        { bfPercentage: 18, bfKg: 12.96, mmPercentage: 44.44, mmKg: 32, bmPercentage: 4, bmKg: 2.88 },
      ],
    });

    await useCase.execute({ claims, measurementId: 'm-2', data: { weight: 80 } });

    expect(measurementsRepository.updateMeasurementWithDetails.mock.calls[0][1].results).toMatchObject({
      bmi: 27.04,
      bmiClassification: 'OVERWEIGHT',
      bfPercentage: 18,
      bfKg: 14.4,
      mmPercentage: 44.44,
      mmKg: 35.55,
      bmPercentage: 4,
      bmKg: 3.2,
    });
  });

  it('en una bioimpedancia, null en un componente opcional lo quita', async () => {
    measurementsRepository.getMeasurementDetailByIdAndPatientId.mockResolvedValue({
      ...bioimpedance,
      measurementResults: [
        { bfPercentage: 18, mmPercentage: 44, vfPercentage: 3, vfKg: 2.16, vfMethod: 'BIOIMPEDANCE' },
      ],
    });

    await useCase.execute({ claims, measurementId: 'm-2', data: { visceralFat: null } });

    expect(measurementsRepository.updateMeasurementWithDetails.mock.calls[0][1].results).toMatchObject({
      bfPercentage: 18,
      vfKg: null,
      vfPercentage: null,
      vfMethod: null,
    });
  });

  it('rechaza con 400 un peso menor que los kg de masa muscular guardados', async () => {
    measurementsRepository.getMeasurementDetailByIdAndPatientId.mockResolvedValue(bioimpedance);

    await expect(
      useCase.execute({ claims, measurementId: 'm-2', data: { weight: 30 } }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(measurementsRepository.updateMeasurementWithDetails).not.toHaveBeenCalled();
  });

  it('rechaza con 400 grasa corporal en una medición que no es de bioimpedancia', async () => {
    measurementsRepository.getMeasurementDetailByIdAndPatientId.mockResolvedValue(basicMeasurement);

    await expect(
      useCase.execute({ claims, measurementId: 'm-1', data: { bodyFat: { value: 18, unit: 'PERCENTAGE' } } }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      useCase.execute({ claims, measurementId: 'm-1', data: { boneMass: { value: 3, unit: 'KG' } } }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rechaza con 400 una fecha futura', async () => {
    measurementsRepository.getMeasurementDetailByIdAndPatientId.mockResolvedValue(basicMeasurement);

    await expect(
      useCase.execute({ claims, measurementId: 'm-1', data: { measuredAt: '2999-01-01T00:00:00.000Z' } }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('crea los valores básicos si la medición no los tenía, pero exige peso y talla juntos', async () => {
    measurementsRepository.getMeasurementDetailByIdAndPatientId.mockResolvedValue({
      ...basicMeasurement,
      basicMeasurements: [],
    });

    await expect(
      useCase.execute({ claims, measurementId: 'm-1', data: { weight: 70 } }),
    ).rejects.toBeInstanceOf(BadRequestException);

    await useCase.execute({ claims, measurementId: 'm-1', data: { weight: 70, height: 170 } });
    expect(measurementsRepository.updateMeasurementWithDetails).toHaveBeenCalledWith(
      'm-1',
      expect.objectContaining({ basic: { weight: 70, height: 170 } }),
    );
  });

  it('lanza 404 si la medición no existe o no es del usuario', async () => {
    measurementsRepository.getMeasurementDetailByIdAndPatientId.mockResolvedValue(null);

    await expect(
      useCase.execute({ claims, measurementId: 'm-x', data: { weight: 70 } }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
