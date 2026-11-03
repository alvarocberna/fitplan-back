import { ExpireUnpaidOrdersJob } from './expire-unpaid-orders.job';
import { ExpireUnpaidOrdersUseCase } from '../use-cases/expire-unpaid-orders.use-case';

describe('ExpireUnpaidOrdersJob', () => {
  let job: ExpireUnpaidOrdersJob;
  let expireUnpaidOrders: { execute: jest.Mock };

  beforeEach(() => {
    expireUnpaidOrders = {
      execute: jest.fn().mockResolvedValue({ expired: 0 }),
    };
    job = new ExpireUnpaidOrdersJob(
      expireUnpaidOrders as unknown as ExpireUnpaidOrdersUseCase,
    );
  });

  it('ejecuta el caso de uso de expiración', async () => {
    await job.run();
    expect(expireUnpaidOrders.execute).toHaveBeenCalledTimes(1);
  });

  it('un error del caso de uso queda contenido (no tumba el scheduler)', async () => {
    expireUnpaidOrders.execute.mockRejectedValue(new Error('fallo inesperado'));
    const errorSpy = jest
      .spyOn((job as any).logger, 'error')
      .mockImplementation(() => undefined);

    await expect(job.run()).resolves.toBeUndefined();
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('fallo inesperado'),
      expect.any(String),
    );
  });
});
