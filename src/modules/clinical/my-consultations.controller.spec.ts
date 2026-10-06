import { Test, TestingModule } from '@nestjs/testing';
import { MyConsultationsController } from './my-consultations.controller';
import { ListMyConsultationsUseCase } from './use-cases/list-my-consultations.use-case';
import { GetMyConsultationUseCase } from './use-cases/get-my-consultation.use-case';
import type { CognitoUserClaims } from '../../common/auth/cognito-user.decorator';

describe('MyConsultationsController', () => {
  let controller: MyConsultationsController;
  let listMyConsultations: { execute: jest.Mock };
  let getMyConsultation: { execute: jest.Mock };

  const claims: CognitoUserClaims = { sub: 'test-sub' };

  beforeEach(async () => {
    listMyConsultations = { execute: jest.fn() };
    getMyConsultation = { execute: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [MyConsultationsController],
      providers: [
        { provide: ListMyConsultationsUseCase, useValue: listMyConsultations },
        { provide: GetMyConsultationUseCase, useValue: getMyConsultation },
      ],
    }).compile();

    controller = module.get(MyConsultationsController);
  });

  it('list() delega en ListMyConsultationsUseCase con los claims', async () => {
    const consultations = [{ consultationId: 'c-1' }];
    listMyConsultations.execute.mockResolvedValue(consultations);

    await expect(controller.list(claims)).resolves.toBe(consultations);
    expect(listMyConsultations.execute).toHaveBeenCalledWith({ claims });
  });

  it('getOne() delega en GetMyConsultationUseCase con los claims y el id', async () => {
    const detail = { consultationId: 'c-1' };
    getMyConsultation.execute.mockResolvedValue(detail);

    await expect(controller.getOne(claims, 'c-1')).resolves.toBe(detail);
    expect(getMyConsultation.execute).toHaveBeenCalledWith({
      claims,
      consultationId: 'c-1',
    });
  });
});
