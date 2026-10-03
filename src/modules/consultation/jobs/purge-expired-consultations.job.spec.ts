import { PurgeExpiredConsultationsJob } from './purge-expired-consultations.job';
import { PurgeExpiredConsultationsUseCase } from '../use-cases/purge-expired-consultations.use-case';

describe('PurgeExpiredConsultationsJob', () => {
  let job: PurgeExpiredConsultationsJob;
  let purgeExpiredConsultations: { execute: jest.Mock };

  beforeEach(() => {
    purgeExpiredConsultations = { execute: jest.fn().mockResolvedValue({ deleted: 0 }) };
    job = new PurgeExpiredConsultationsJob(
      purgeExpiredConsultations as unknown as PurgeExpiredConsultationsUseCase,
    );
  });

  it('ejecuta el caso de uso de purga', async () => {
    await job.run();
    expect(purgeExpiredConsultations.execute).toHaveBeenCalledTimes(1);
  });

  it('un error del caso de uso queda contenido (no tumba el scheduler)', async () => {
    purgeExpiredConsultations.execute.mockRejectedValue(new Error('fallo inesperado'));
    const errorSpy = jest
      .spyOn((job as any).logger, 'error')
      .mockImplementation(() => undefined);

    await expect(job.run()).resolves.toBeUndefined();
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('fallo inesperado'));
  });
});
