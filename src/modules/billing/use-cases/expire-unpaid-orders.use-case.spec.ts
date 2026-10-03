import { ExpireUnpaidOrdersUseCase } from './expire-unpaid-orders.use-case';
import { OrderRepository } from '../../../domain/repositories/commercial-domain/order.repository';
import { OrderLifecycleService } from '../order-lifecycle.service';

describe('ExpireUnpaidOrdersUseCase', () => {
  let useCase: ExpireUnpaidOrdersUseCase;
  let orderRepository: { getDueUnpaidOrderIds: jest.Mock };
  let orderLifecycle: { expireIfDue: jest.Mock };

  beforeEach(() => {
    orderRepository = { getDueUnpaidOrderIds: jest.fn().mockResolvedValue([]) };
    orderLifecycle = { expireIfDue: jest.fn().mockResolvedValue(true) };
    useCase = new ExpireUnpaidOrdersUseCase(
      orderRepository as unknown as OrderRepository,
      orderLifecycle as unknown as OrderLifecycleService,
    );
  });

  it('sin órdenes vencidas no expira nada', async () => {
    await expect(useCase.execute()).resolves.toEqual({ expired: 0 });
    expect(orderRepository.getDueUnpaidOrderIds).toHaveBeenCalledWith(
      expect.any(Date),
      expect.any(Number),
    );
    expect(orderLifecycle.expireIfDue).not.toHaveBeenCalled();
  });

  it('expira cada orden vencida y cuenta solo las que esta corrida expiró', async () => {
    orderRepository.getDueUnpaidOrderIds.mockResolvedValue(['order-1', 'order-2', 'order-3']);
    // order-2 la expiró otro proceso entre la lectura y la escritura
    orderLifecycle.expireIfDue
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);

    await expect(useCase.execute()).resolves.toEqual({ expired: 2 });
    expect(orderLifecycle.expireIfDue).toHaveBeenCalledTimes(3);
  });

  it('una orden que falla no frena al resto', async () => {
    orderRepository.getDueUnpaidOrderIds.mockResolvedValue(['order-1', 'order-2']);
    orderLifecycle.expireIfDue
      .mockRejectedValueOnce(new Error('db caída'))
      .mockResolvedValueOnce(true);
    const errorSpy = jest
      .spyOn((useCase as any).logger, 'error')
      .mockImplementation(() => undefined);

    await expect(useCase.execute()).resolves.toEqual({ expired: 1 });
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('db caída'));
  });
});
