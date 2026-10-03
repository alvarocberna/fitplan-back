import { RetryPendingGenerationsUseCase } from './retry-pending-generations.use-case';
import { OrderLifecycleService } from '../../billing/order-lifecycle.service';
import { GeneratePersonalizedPlanUseCase } from './generate-personalized-plan.use-case';

describe('RetryPendingGenerationsUseCase', () => {
  let useCase: RetryPendingGenerationsUseCase;
  let orderLifecycle: {
    releaseStalledGenerations: jest.Mock;
    findOrderIdsPendingGeneration: jest.Mock;
  };
  let generatePersonalizedPlan: { execute: jest.Mock };

  beforeEach(() => {
    orderLifecycle = {
      releaseStalledGenerations: jest.fn().mockResolvedValue(0),
      findOrderIdsPendingGeneration: jest.fn().mockResolvedValue([]),
    };
    generatePersonalizedPlan = { execute: jest.fn().mockResolvedValue(undefined) };
    useCase = new RetryPendingGenerationsUseCase(
      orderLifecycle as unknown as OrderLifecycleService,
      generatePersonalizedPlan as unknown as GeneratePersonalizedPlanUseCase,
    );
  });

  it('sin órdenes pendientes no genera nada', async () => {
    await expect(useCase.execute()).resolves.toEqual({ released: 0, retried: 0 });
    expect(generatePersonalizedPlan.execute).not.toHaveBeenCalled();
  });

  it('libera primero las generaciones interrumpidas y después relanza cada orden pendiente, en orden', async () => {
    const calls: string[] = [];
    orderLifecycle.releaseStalledGenerations.mockImplementation(async () => {
      calls.push('release');
      return 1;
    });
    orderLifecycle.findOrderIdsPendingGeneration.mockImplementation(async () => {
      calls.push('find');
      return ['order-1', 'order-2'];
    });
    jest.spyOn((useCase as any).logger, 'warn').mockImplementation(() => undefined);

    await expect(useCase.execute()).resolves.toEqual({ released: 1, retried: 2 });

    expect(calls).toEqual(['release', 'find']);
    expect(generatePersonalizedPlan.execute.mock.calls).toEqual([
      [{ orderId: 'order-1' }],
      [{ orderId: 'order-2' }],
    ]);
  });

  it('un error no controlado en una orden no frena al resto', async () => {
    orderLifecycle.findOrderIdsPendingGeneration.mockResolvedValue(['order-1', 'order-2']);
    generatePersonalizedPlan.execute
      .mockRejectedValueOnce(new Error('fallo inesperado'))
      .mockResolvedValueOnce(undefined);
    const errorSpy = jest
      .spyOn((useCase as any).logger, 'error')
      .mockImplementation(() => undefined);

    await expect(useCase.execute()).resolves.toEqual({ released: 0, retried: 2 });
    expect(generatePersonalizedPlan.execute).toHaveBeenCalledTimes(2);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('fallo inesperado'), expect.any(String));
  });
});
