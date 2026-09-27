import { CreateOrderUseCase } from './create-order.use-case';
import { OrderRepository } from '../../../domain/repositories/commercial-domain/order.repository';

describe('CreateOrderUseCase', () => {
  it('crea la orden pendiente con monto y moneda del producto, sin archivos ni plan', async () => {
    const orderRepository = { createOrder: jest.fn().mockResolvedValue({ id: 'order-1' }) };
    const useCase = new CreateOrderUseCase(orderRepository as unknown as OrderRepository);

    await expect(
      useCase.execute({
        userId: 'user-1',
        product: { id: 'product-1', price: 14990, currency: 'CLP' },
      }),
    ).resolves.toEqual({ id: 'order-1' });

    expect(orderRepository.createOrder).toHaveBeenCalledWith({
      userId: 'user-1',
      productId: 'product-1',
      amount: 14990,
      currency: 'CLP',
      paymentStatus: 'PENDING',
      generationStatus: 'NOT_STARTED',
      planJson: null,
      pdfKey: null,
      thumbnailKey: null,
      attempts: 0,
      creationDate: expect.any(Date),
      paymentDate: null,
      expirationDate: null,
    });
  });
});
