import { OrderExpiredListener } from './order-expired.listener';
import { DeleteExpiredConsultationUseCase } from '../use-cases/delete-expired-consultation.use-case';

describe('OrderExpiredListener', () => {
  let listener: OrderExpiredListener;
  let deleteExpiredConsultation: { execute: jest.Mock };

  beforeEach(() => {
    deleteExpiredConsultation = { execute: jest.fn().mockResolvedValue({ deleted: true }) };
    listener = new OrderExpiredListener(
      deleteExpiredConsultation as unknown as DeleteExpiredConsultationUseCase,
    );
  });

  it('borra la consulta de la orden expirada', () => {
    listener.handle({ orderId: 'order-1' });

    expect(deleteExpiredConsultation.execute).toHaveBeenCalledWith({ orderId: 'order-1' });
  });

  it('un error inesperado en el borrado queda contenido (no se propaga)', async () => {
    deleteExpiredConsultation.execute.mockRejectedValue(new Error('fallo inesperado'));
    const errorSpy = jest
      .spyOn((listener as any).logger, 'error')
      .mockImplementation(() => undefined);

    expect(() => listener.handle({ orderId: 'order-1' })).not.toThrow();

    // deja correr el microtask del .catch() fire-and-forget antes de verificar
    await new Promise((resolve) => setImmediate(resolve));
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('fallo inesperado'), expect.any(String));
  });
});
