import { Test, TestingModule } from '@nestjs/testing';
import { StandardPlansController } from './standard-plans.controller';
import { MyPlansController } from './my-plans.controller';
import { ListStandardPlanPreviewsUseCase } from './use-cases/list-standard-plan-previews.use-case';
import { GetStandardPlanUseCase } from './use-cases/get-standard-plan.use-case';
import { PurchaseStandardPlanUseCase } from './use-cases/purchase-standard-plan.use-case';
import { ListMyPlansUseCase } from './use-cases/list-my-plans.use-case';
import type { CognitoUserClaims } from '../../common/auth/cognito-user.decorator';

describe('StandardPlansController / MyPlansController', () => {
  let standardPlans: StandardPlansController;
  let myPlans: MyPlansController;
  let listPreviews: { execute: jest.Mock };
  let getStandardPlan: { execute: jest.Mock };
  let purchaseStandardPlan: { execute: jest.Mock };
  let listMyPlans: { execute: jest.Mock };

  const code = 'plan-gimnasio-volumen-50-60-m-joven';
  const claims: CognitoUserClaims = { sub: 'test-sub' };

  beforeEach(async () => {
    listPreviews = { execute: jest.fn() };
    getStandardPlan = { execute: jest.fn() };
    purchaseStandardPlan = { execute: jest.fn() };
    listMyPlans = { execute: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [StandardPlansController, MyPlansController],
      providers: [
        { provide: ListStandardPlanPreviewsUseCase, useValue: listPreviews },
        { provide: GetStandardPlanUseCase, useValue: getStandardPlan },
        { provide: PurchaseStandardPlanUseCase, useValue: purchaseStandardPlan },
        { provide: ListMyPlansUseCase, useValue: listMyPlans },
      ],
    }).compile();

    standardPlans = module.get(StandardPlansController);
    myPlans = module.get(MyPlansController);
  });

  it('previews() delega en ListStandardPlanPreviewsUseCase', async () => {
    const previews = [{ code: 'plan-running', name: 'Plan Running', description: 'x', thumbnailUrl: null }];
    listPreviews.execute.mockResolvedValue(previews);

    await expect(standardPlans.previews()).resolves.toBe(previews);
  });

  it('get() delega en GetStandardPlanUseCase con el code de la ruta', async () => {
    const plan = { code, name: 'Plan', description: 'x', price: 14990, currency: 'CLP', thumbnailUrl: null };
    getStandardPlan.execute.mockResolvedValue(plan);

    await expect(standardPlans.get(code)).resolves.toBe(plan);
    expect(getStandardPlan.execute).toHaveBeenCalledWith({ code });
  });

  it('purchase() delega en PurchaseStandardPlanUseCase con el code de la ruta y los claims', async () => {
    purchaseStandardPlan.execute.mockResolvedValue({ orderId: 'order-2' });

    await expect(standardPlans.purchase(code, claims)).resolves.toEqual({ orderId: 'order-2' });
    expect(purchaseStandardPlan.execute).toHaveBeenCalledWith({ claims, code });
  });

  it('GET /me/plans delega en ListMyPlansUseCase con los claims', async () => {
    listMyPlans.execute.mockResolvedValue([]);

    await expect(myPlans.list(claims)).resolves.toEqual([]);
    expect(listMyPlans.execute).toHaveBeenCalledWith({ claims });
  });
});
