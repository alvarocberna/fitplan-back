import { OrderPaidListener } from './order-paid.listener';
import { GeneratePersonalizedPlanUseCase } from '../use-cases/generate-personalized-plan.use-case';

describe('OrderPaidListener', () => {
  let listener: OrderPaidListener;
  let generatePersonalizedPlan: { execute: jest.Mock };

  beforeEach(() => {
    generatePersonalizedPlan = {
      execute: jest.fn().mockResolvedValue(undefined),
    };
    listener = new OrderPaidListener(
      generatePersonalizedPlan as unknown as GeneratePersonalizedPlanUseCase,
    );
  });

  it('producto GENERATED: dispara la generación del plan de la orden', () => {
    listener.handle({ orderId: 'order-1', productType: 'GENERATED' });

    expect(generatePersonalizedPlan.execute).toHaveBeenCalledWith({
      orderId: 'order-1',
      trigger: 'payment',
    });
  });

  it('producto PREDEFINED: no genera nada (el PDF ya se copió desde el producto)', () => {
    listener.handle({ orderId: 'order-1', productType: 'PREDEFINED' });

    expect(generatePersonalizedPlan.execute).not.toHaveBeenCalled();
  });

  it('un error inesperado en la generación queda contenido (no se propaga)', async () => {
    generatePersonalizedPlan.execute.mockRejectedValue(
      new Error('fallo inesperado'),
    );
    const errorSpy = jest
      .spyOn((listener as any).logger, 'error')
      .mockImplementation(() => undefined);

    expect(() =>
      listener.handle({ orderId: 'order-1', productType: 'GENERATED' }),
    ).not.toThrow();

    // deja correr el microtask del .catch() fire-and-forget antes de verificar
    await new Promise((resolve) => setImmediate(resolve));
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('fallo inesperado'),
      expect.any(String),
    );
  });
});
