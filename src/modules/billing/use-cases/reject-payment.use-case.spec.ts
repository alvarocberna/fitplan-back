import { ConflictException, NotFoundException } from '@nestjs/common';
import { RejectPaymentUseCase } from './reject-payment.use-case';
import { OrderRepository } from '../../../domain/repositories/commercial-domain/order.repository';
import { OrderLifecycleService } from '../order-lifecycle.service';
import { CurrentUserResolver } from '../../identity/current-user.resolver';

describe('RejectPaymentUseCase', () => {
  let useCase: RejectPaymentUseCase;
  let orderRepository: {
    getOrderById: jest.Mock;
    markOrderAsRejectedWithPayment: jest.Mock;
  };
  let orderLifecycle: { isExpired: jest.Mock };
  let currentUser: { resolve: jest.Mock };

  const order = { id: 'order-1', amount: 19990, paymentStatus: 'PENDING' };

  beforeEach(() => {
    orderRepository = {
      getOrderById: jest.fn().mockResolvedValue(order),
      markOrderAsRejectedWithPayment: jest.fn().mockResolvedValue(true),
    };
    orderLifecycle = { isExpired: jest.fn().mockResolvedValue(false) };
    currentUser = { resolve: jest.fn().mockResolvedValue({ id: 'user-1' }) };
    useCase = new RejectPaymentUseCase(
      orderRepository as unknown as OrderRepository,
      orderLifecycle as unknown as OrderLifecycleService,
      currentUser as unknown as CurrentUserResolver,
    );
  });

  it('lanza NotFoundException si la orden no existe, sin registrar el rechazo', async () => {
    orderRepository.getOrderById.mockResolvedValue(null);

    await expect(useCase.execute({ orderId: 'missing' })).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(orderRepository.markOrderAsRejectedWithPayment).not.toHaveBeenCalled();
  });

  it('registra el payment REJECTED con el monto de la orden y responde rejected', async () => {
    await expect(useCase.execute({ orderId: 'order-1' })).resolves.toEqual({
      status: 'rejected',
    });

    expect(orderRepository.markOrderAsRejectedWithPayment).toHaveBeenCalledWith(
      'order-1',
      expect.objectContaining({
        provider: 'SIMULATED',
        paymentIdentifier: 'SIM-order-1',
        amount: 19990,
        status: 'REJECTED',
        transactionDate: expect.any(Date),
      }),
      undefined,
    );
  });

  it('con el resultado de la pasarela completa ese intento en vez de crear un rechazo simulado', async () => {
    const result = {
      provider: 'TRANSBANK' as const,
      paymentIdentifier: 'buy-order-1',
      amount: 19990,
      status: 'REJECTED' as const,
      responseCode: -1,
    };

    await expect(
      useCase.execute({ orderId: 'order-1', payment: { paymentId: 'payment-1', result } }),
    ).resolves.toEqual({ status: 'rejected' });

    expect(orderRepository.markOrderAsRejectedWithPayment).toHaveBeenCalledWith(
      'order-1',
      result,
      'payment-1',
    );
  });

  it('orden ya pagada: responde already_processed (el rechazo se ignora)', async () => {
    orderRepository.markOrderAsRejectedWithPayment.mockResolvedValue(false);

    await expect(useCase.execute({ orderId: 'order-1' })).resolves.toEqual({
      status: 'already_processed',
    });
  });

  it('orden expirada o con el plazo vencido: responde 409', async () => {
    orderRepository.markOrderAsRejectedWithPayment.mockResolvedValue(false);
    orderLifecycle.isExpired.mockResolvedValue(true);

    await expect(useCase.execute({ orderId: 'order-1' })).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(orderLifecycle.isExpired).toHaveBeenCalledWith(order);
  });

  it('con claims: responde 404 (R2) y no registra el rechazo si la orden es de otro usuario', async () => {
    orderRepository.getOrderById.mockResolvedValue({ ...order, userId: 'otro-usuario' });

    await expect(
      useCase.execute({ orderId: 'order-1', claims: { sub: 'sub-1' } }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(orderRepository.markOrderAsRejectedWithPayment).not.toHaveBeenCalled();
  });

  it('con claims: rechaza el pago si la orden es del usuario del token', async () => {
    orderRepository.getOrderById.mockResolvedValue({ ...order, userId: 'user-1' });

    await expect(
      useCase.execute({ orderId: 'order-1', claims: { sub: 'sub-1' } }),
    ).resolves.toEqual({ status: 'rejected' });
  });
});
