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

  it('corrige peso y fecha de una medición de consulta, sin tocar sus resultados, y devuelve el detalle actualizado', async () => {
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
      results: undefined,
    });
    expect(detail.raw.basic).toEqual({ weight: 70, height: 172 });
  });

  it('en una bioimpedancia reemplaza el valor de grasa enviado y valida la masa muscular guardada contra el peso nuevo', async () => {
    measurementsRepository.getMeasurementDetailByIdAndPatientId.mockResolvedValue(bioimpedance);

    await useCase.execute({
      claims,
      measurementId: 'm-2',
      data: { bodyFat: { value: 12, unit: 'KG' } },
    });

    expect(measurementsRepository.updateMeasurementWithDetails).toHaveBeenCalledWith('m-2', {
      measuredAt: undefined,
      basic: undefined,
      results: { bfPercentage: null, bfKg: 12, bfMethod: 'BIOIMPEDANCE' },
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
