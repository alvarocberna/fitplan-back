import { Test, TestingModule } from '@nestjs/testing';
import { PersonalizedPlansController } from './personalized-plans.controller';
import { GetPersonalizedPlanUseCase } from './use-cases/get-personalized-plan.use-case';

describe('PersonalizedPlansController', () => {
  let controller: PersonalizedPlansController;
  let getPersonalizedPlan: { execute: jest.Mock };

  beforeEach(async () => {
    getPersonalizedPlan = { execute: jest.fn() };
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PersonalizedPlansController],
      providers: [
        { provide: GetPersonalizedPlanUseCase, useValue: getPersonalizedPlan },
      ],
    }).compile();

    controller = module.get(PersonalizedPlansController);
  });

  it('get() delega en GetPersonalizedPlanUseCase', async () => {
    const plan = {
      name: 'Plan Nutricional Personalizado',
      description: 'x',
      price: 4990,
      currency: 'CLP',
    };
    getPersonalizedPlan.execute.mockResolvedValue(plan);

    await expect(controller.get()).resolves.toBe(plan);
  });
});
