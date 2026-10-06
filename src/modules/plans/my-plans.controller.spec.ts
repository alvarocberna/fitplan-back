import { Test, TestingModule } from '@nestjs/testing';
import { MyPlansController } from './my-plans.controller';
import { ListMyPlansUseCase } from './use-cases/list-my-plans.use-case';
import { GetMyPlanUseCase } from './use-cases/get-my-plan.use-case';
import { GetMyLatestPlanProjectionUseCase } from './use-cases/get-my-latest-plan-projection.use-case';
import type { CognitoUserClaims } from '../../common/auth/cognito-user.decorator';

describe('MyPlansController', () => {
  let controller: MyPlansController;
  let listMyPlans: { execute: jest.Mock };
  let getMyPlan: { execute: jest.Mock };
  let getMyLatestPlanProjection: { execute: jest.Mock };

  const claims: CognitoUserClaims = { sub: 'test-sub' };

  beforeEach(async () => {
    listMyPlans = { execute: jest.fn() };
    getMyPlan = { execute: jest.fn() };
    getMyLatestPlanProjection = { execute: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [MyPlansController],
      providers: [
        { provide: ListMyPlansUseCase, useValue: listMyPlans },
        { provide: GetMyPlanUseCase, useValue: getMyPlan },
        { provide: GetMyLatestPlanProjectionUseCase, useValue: getMyLatestPlanProjection },
      ],
    }).compile();

    controller = module.get(MyPlansController);
  });

  it('list() delega en ListMyPlansUseCase con los claims', async () => {
    const plans = [{ orderId: 'order-1' }];
    listMyPlans.execute.mockResolvedValue(plans);

    await expect(controller.list(claims)).resolves.toBe(plans);
    expect(listMyPlans.execute).toHaveBeenCalledWith({ claims });
  });

  it('getOne() delega en GetMyPlanUseCase con los claims y el orderId', async () => {
    const detail = { orderId: 'order-1' };
    getMyPlan.execute.mockResolvedValue(detail);

    await expect(controller.getOne(claims, 'order-1')).resolves.toBe(detail);
    expect(getMyPlan.execute).toHaveBeenCalledWith({ claims, orderId: 'order-1' });
  });

  it('latestProjection() delega en GetMyLatestPlanProjectionUseCase con los claims', async () => {
    const latest = { orderId: 'order-1', projection: null };
    getMyLatestPlanProjection.execute.mockResolvedValue(latest);

    await expect(controller.latestProjection(claims)).resolves.toBe(latest);
    expect(getMyLatestPlanProjection.execute).toHaveBeenCalledWith({ claims });
  });
});
