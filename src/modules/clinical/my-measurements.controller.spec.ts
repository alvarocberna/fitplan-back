import { Test, TestingModule } from '@nestjs/testing';
import { MyMeasurementsController } from './my-measurements.controller';
import { ListMyMeasurementsUseCase } from './use-cases/list-my-measurements.use-case';
import { GetMyMeasurementUseCase } from './use-cases/get-my-measurement.use-case';
import { RecordMeasurementUseCase } from './use-cases/record-measurement.use-case';
import { UpdateMyMeasurementUseCase } from './use-cases/update-my-measurement.use-case';
import type { CognitoUserClaims } from '../../common/auth/cognito-user.decorator';
import type { RecordMeasurementDtoImpl } from './dto/measurement.dto';

describe('MyMeasurementsController', () => {
  let controller: MyMeasurementsController;
  let list: { execute: jest.Mock };
  let getOne: { execute: jest.Mock };
  let record: { execute: jest.Mock };
  let update: { execute: jest.Mock };

  const claims: CognitoUserClaims = { sub: 'test-sub' };

  beforeEach(async () => {
    list = { execute: jest.fn() };
    getOne = { execute: jest.fn() };
    record = { execute: jest.fn() };
    update = { execute: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [MyMeasurementsController],
      providers: [
        { provide: ListMyMeasurementsUseCase, useValue: list },
        { provide: GetMyMeasurementUseCase, useValue: getOne },
        { provide: RecordMeasurementUseCase, useValue: record },
        { provide: UpdateMyMeasurementUseCase, useValue: update },
      ],
    }).compile();

    controller = module.get(MyMeasurementsController);
  });

  it('list() convierte el rango de fechas y delega en ListMyMeasurementsUseCase', async () => {
    list.execute.mockResolvedValue([]);

    await controller.list(claims, { from: '2026-01-01T00:00:00.000Z' });

    expect(list.execute).toHaveBeenCalledWith({
      claims,
      from: new Date('2026-01-01T00:00:00.000Z'),
      to: undefined,
    });
  });

  it('getOne() delega en GetMyMeasurementUseCase', async () => {
    getOne.execute.mockResolvedValue({ measurementId: 'm-1' });

    await expect(controller.getOne(claims, 'm-1')).resolves.toEqual({ measurementId: 'm-1' });
    expect(getOne.execute).toHaveBeenCalledWith({ claims, measurementId: 'm-1' });
  });

  it('record() delega en RecordMeasurementUseCase con el body', async () => {
    const body = { level: 'BASIC', weight: 70, height: 172 } as RecordMeasurementDtoImpl;
    record.execute.mockResolvedValue({ measurementId: 'm-new' });

    await expect(controller.record(claims, body)).resolves.toEqual({ measurementId: 'm-new' });
    expect(record.execute).toHaveBeenCalledWith({ claims, data: body });
  });

  it('update() delega en UpdateMyMeasurementUseCase con el id y el body', async () => {
    update.execute.mockResolvedValue({ measurementId: 'm-1' });

    await controller.update(claims, 'm-1', { weight: 70 });

    expect(update.execute).toHaveBeenCalledWith({ claims, measurementId: 'm-1', data: { weight: 70 } });
  });
});
