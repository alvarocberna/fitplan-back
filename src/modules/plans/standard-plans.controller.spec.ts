import { Test, TestingModule } from '@nestjs/testing';
import { StandardPlansController } from './standard-plans.controller';
import { ListStandardPlanPreviewsUseCase } from './use-cases/list-standard-plan-previews.use-case';
import { GetStandardPlanUseCase } from './use-cases/get-standard-plan.use-case';
import { PurchaseStandardPlanUseCase } from './use-cases/purchase-standard-plan.use-case';
import type { CognitoUserClaims } from '../../common/auth/cognito-user.decorator';

// MyPlansController (/me/plans) tiene su propio spec: my-plans.controller.spec.ts.
describe('StandardPlansController', () => {
  let standardPlans: StandardPlansController;
  let listPreviews: { execute: jest.Mock };
  let getStandardPlan: { execute: jest.Mock };
  let purchaseStandardPlan: { execute: jest.Mock };

  const code = 'plan-gimnasio-volumen-50-60-m-joven';
  const claims: CognitoUserClaims = { sub: 'test-sub' };

  beforeEach(async () => {
    listPreviews = { execute: jest.fn() };
    getStandardPlan = { execute: jest.fn() };
    purchaseStandardPlan = { execute: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [StandardPlansController],
      providers: [
        { provide: ListStandardPlanPreviewsUseCase, useValue: listPreviews },
        { provide: GetStandardPlanUseCase, useValue: getStandardPlan },
        {
          provide: PurchaseStandardPlanUseCase,
          useValue: purchaseStandardPlan,
        },
      ],
    }).compile();

    standardPlans = module.get(StandardPlansController);
  });

  it('previews() delega en ListStandardPlanPreviewsUseCase', async () => {
    const previews = [
      {
        code: 'plan-running',
        name: 'Plan Running',
        description: 'x',
        thumbnailUrl: null,
      },
    ];
    listPreviews.execute.mockResolvedValue(previews);

    await expect(standardPlans.previews()).resolves.toBe(previews);
  });

  it('get() delega en GetStandardPlanUseCase con el code de la ruta', async () => {
    const plan = {
      code,
      name: 'Plan',
      description: 'x',
      price: 14990,
      currency: 'CLP',
      thumbnailUrl: null,
    };
    getStandardPlan.execute.mockResolvedValue(plan);

    await expect(standardPlans.get(code)).resolves.toBe(plan);
    expect(getStandardPlan.execute).toHaveBeenCalledWith({ code });
  });

  it('purchase() delega en PurchaseStandardPlanUseCase con el code de la ruta y los claims', async () => {
    purchaseStandardPlan.execute.mockResolvedValue({ orderId: 'order-2' });

    await expect(standardPlans.purchase(code, claims)).resolves.toEqual({
      orderId: 'order-2',
    });
    expect(purchaseStandardPlan.execute).toHaveBeenCalledWith({ claims, code });
  });
});
