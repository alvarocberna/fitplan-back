import { PurgeExpiredConsultationsUseCase } from './purge-expired-consultations.use-case';
import { DeleteExpiredConsultationUseCase } from './delete-expired-consultation.use-case';
import { NutritionalConsultationRepository } from '../../../domain/repositories/clinical-domain/nutritional-consultation.repository';

describe('PurgeExpiredConsultationsUseCase', () => {
  let useCase: PurgeExpiredConsultationsUseCase;
  let nutritionalConsultationRepository: {
    getOrderIdsOfConsultationsWithExpiredOrder: jest.Mock;
  };
  let deleteExpiredConsultation: { execute: jest.Mock };

  beforeEach(() => {
    nutritionalConsultationRepository = {
      getOrderIdsOfConsultationsWithExpiredOrder: jest.fn().mockResolvedValue([]),
    };
    deleteExpiredConsultation = { execute: jest.fn().mockResolvedValue({ deleted: true }) };
    useCase = new PurgeExpiredConsultationsUseCase(
      nutritionalConsultationRepository as unknown as NutritionalConsultationRepository,
      deleteExpiredConsultation as unknown as DeleteExpiredConsultationUseCase,
    );
    jest.spyOn((useCase as any).logger, 'warn').mockImplementation(() => undefined);
  });

  it('sin consultas pendientes de borrar no hace nada', async () => {
    await expect(useCase.execute()).resolves.toEqual({ deleted: 0 });
    expect(deleteExpiredConsultation.execute).not.toHaveBeenCalled();
  });

  it('borra la consulta de cada orden expirada y cuenta solo las que efectivamente borró', async () => {
    nutritionalConsultationRepository.getOrderIdsOfConsultationsWithExpiredOrder.mockResolvedValue([
      'order-1',
      'order-2',
    ]);
    // order-2 la borró otro proceso (el listener) entre la lectura y el borrado
    deleteExpiredConsultation.execute
      .mockResolvedValueOnce({ deleted: true })
      .mockResolvedValueOnce({ deleted: false });

    await expect(useCase.execute()).resolves.toEqual({ deleted: 1 });
    expect(deleteExpiredConsultation.execute.mock.calls).toEqual([
      [{ orderId: 'order-1' }],
      [{ orderId: 'order-2' }],
    ]);
  });

  it('una consulta que falla no frena al resto', async () => {
    nutritionalConsultationRepository.getOrderIdsOfConsultationsWithExpiredOrder.mockResolvedValue([
      'order-1',
      'order-2',
    ]);
    deleteExpiredConsultation.execute
      .mockRejectedValueOnce(new Error('db caída'))
      .mockResolvedValueOnce({ deleted: true });
    const errorSpy = jest
      .spyOn((useCase as any).logger, 'error')
      .mockImplementation(() => undefined);

    await expect(useCase.execute()).resolves.toEqual({ deleted: 1 });
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('db caída'));
  });
});
