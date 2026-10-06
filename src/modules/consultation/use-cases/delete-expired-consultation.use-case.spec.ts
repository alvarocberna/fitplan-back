import { DeleteExpiredConsultationUseCase } from './delete-expired-consultation.use-case';
import { NutritionalConsultationRepository } from '../../../domain/repositories/clinical-domain/nutritional-consultation.repository';

describe('DeleteExpiredConsultationUseCase', () => {
  let useCase: DeleteExpiredConsultationUseCase;
  let nutritionalConsultationRepository: {
    deleteNutritionalConsultationByOrderId: jest.Mock;
  };

  beforeEach(() => {
    nutritionalConsultationRepository = {
      deleteNutritionalConsultationByOrderId: jest.fn(),
    };
    useCase = new DeleteExpiredConsultationUseCase(
      nutritionalConsultationRepository as unknown as NutritionalConsultationRepository,
    );
  });

  it('borra la consulta de la orden expirada', async () => {
    nutritionalConsultationRepository.deleteNutritionalConsultationByOrderId.mockResolvedValue(true);

    await expect(useCase.execute({ orderId: 'order-1' })).resolves.toEqual({ deleted: true });
    expect(
      nutritionalConsultationRepository.deleteNutritionalConsultationByOrderId,
    ).toHaveBeenCalledWith('order-1');
  });

  it('orden sin consulta (plan estándar): no hay nada que borrar', async () => {
    nutritionalConsultationRepository.deleteNutritionalConsultationByOrderId.mockResolvedValue(false);

    await expect(useCase.execute({ orderId: 'order-2' })).resolves.toEqual({ deleted: false });
  });
});
