import { RetryPendingGenerationsJob } from './retry-pending-generations.job';
import { RetryPendingGenerationsUseCase } from '../use-cases/retry-pending-generations.use-case';

describe('RetryPendingGenerationsJob', () => {
  let job: RetryPendingGenerationsJob;
  let retryPendingGenerations: { execute: jest.Mock };

  beforeEach(() => {
    retryPendingGenerations = {
      execute: jest.fn().mockResolvedValue({ released: 0, retried: 0 }),
    };
    job = new RetryPendingGenerationsJob(
      retryPendingGenerations as unknown as RetryPendingGenerationsUseCase,
    );
  });

  it('ejecuta el caso de uso de reintentos', async () => {
    await job.run();
    expect(retryPendingGenerations.execute).toHaveBeenCalledTimes(1);
  });

  it('no solapa corridas: si la anterior sigue en curso, no vuelve a ejecutar', async () => {
    let finish!: () => void;
    retryPendingGenerations.execute.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
    );

    const first = job.run();
    await job.run();
    expect(retryPendingGenerations.execute).toHaveBeenCalledTimes(1);

    finish();
    await first;
    await job.run();
    expect(retryPendingGenerations.execute).toHaveBeenCalledTimes(2);
  });

  it('un error del caso de uso queda contenido y no bloquea la corrida siguiente', async () => {
    retryPendingGenerations.execute.mockRejectedValueOnce(new Error('fallo inesperado'));
    const errorSpy = jest
      .spyOn((job as any).logger, 'error')
      .mockImplementation(() => undefined);

    await expect(job.run()).resolves.toBeUndefined();
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('fallo inesperado'), expect.any(String));

    await job.run();
    expect(retryPendingGenerations.execute).toHaveBeenCalledTimes(2);
  });
});
