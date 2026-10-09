import { ConflictException, NotFoundException } from '@nestjs/common';
import {
  CHECKOUT_MIN_WINDOW_MS,
  StartPaymentUseCase,
} from './start-payment.use-case';
import { PaymentGateway } from '../../../domain/ports';
import { PaymentGatewayUnavailableError } from '../../../domain/errors/payment.errors';
import { OrderRepository } from '../../../domain/repositories/commercial-domain/order.repository';
import { PaymentRepository } from '../../../domain/repositories/commercial-domain/payment.repository';
import { ErrorCode } from '../../../common/errors/error-codes';
import { OrderLifecycleService } from '../order-lifecycle.service';
import { CurrentUserResolver } from '../../identity/current-user.resolver';

describe('StartPaymentUseCase', () => {
  let useCase: StartPaymentUseCase;
  let orderRepository: { getOrderById: jest.Mock; updateOrderById: jest.Mock };
  let paymentRepository: { createPayment: jest.Mock };
  let orderLifecycle: { isExpired: jest.Mock };
  let paymentGateway: { createTransaction: jest.Mock };
  let currentUser: { resolve: jest.Mock };

  const claims = { sub: 'sub-1' };
  const HOUR_MS = 60 * 60 * 1000;
  const order = {
    id: 'order-1',
    userId: 'user-1',
    amount: 19990,
    currency: 'CLP',
    paymentStatus: 'PENDING',
    expirationDate: new Date(Date.now() + 5 * HOUR_MS),
  };

  beforeEach(() => {
    orderRepository = {
      getOrderById: jest.fn().mockResolvedValue(order),
      updateOrderById: jest.fn(),
    };
    paymentRepository = { createPayment: jest.fn() };
    orderLifecycle = { isExpired: jest.fn().mockResolvedValue(false) };
    paymentGateway = {
      createTransaction: jest.fn().mockResolvedValue({
        token: 'tok-1',
        redirectUrl: 'https://webpay.test/init',
      }),
    };
    currentUser = { resolve: jest.fn().mockResolvedValue({ id: 'user-1' }) };
    useCase = new StartPaymentUseCase(
      currentUser as unknown as CurrentUserResolver,
      orderRepository as unknown as OrderRepository,
      paymentRepository as unknown as PaymentRepository,
      orderLifecycle as unknown as OrderLifecycleService,
      paymentGateway as unknown as PaymentGateway,
    );
  });

  it('crea la transacción con el monto de la orden y registra el intento INITIATED', async () => {
    await expect(
      useCase.execute({ claims, orderId: 'order-1' }),
    ).resolves.toEqual({
      url: 'https://webpay.test/init',
      token: 'tok-1',
    });

    const { buyOrder } = paymentGateway.createTransaction.mock.calls[0][0];
    expect(buyOrder).toMatch(/^[0-9a-f]{26}$/);
    expect(paymentGateway.createTransaction).toHaveBeenCalledWith({
      buyOrder,
      sessionId: 'user-1',
      amount: 19990,
    });
    expect(paymentRepository.createPayment).toHaveBeenCalledWith({
      orderId: 'order-1',
      provider: 'TRANSBANK',
      paymentIdentifier: buyOrder,
      token: 'tok-1',
      amount: 19990,
      status: 'INITIATED',
    });
    expect(orderRepository.updateOrderById).not.toHaveBeenCalled();
  });

  it('cada intento usa una orden de compra distinta', async () => {
    await useCase.execute({ claims, orderId: 'order-1' });
    await useCase.execute({ claims, orderId: 'order-1' });

    const [first, second] = paymentGateway.createTransaction.mock.calls.map(
      ([input]) => input.buyOrder,
    );
    expect(first).not.toBe(second);
  });

  it.each([
    ['no existe', null],
    ['es de otro usuario', { ...order, userId: 'otro-usuario' }],
  ])(
    'responde 404 (R2) si la orden %s, sin llamar a la pasarela',
    async (_name, found) => {
      orderRepository.getOrderById.mockResolvedValue(found);

      await expect(
        useCase.execute({ claims, orderId: 'order-1' }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(paymentGateway.createTransaction).not.toHaveBeenCalled();
    },
  );

  it('responde 409 ORDER_ALREADY_PAID si la orden ya está pagada', async () => {
    orderRepository.getOrderById.mockResolvedValue({
      ...order,
      paymentStatus: 'PAID',
    });

    const error = await useCase
      .execute({ claims, orderId: 'order-1' })
      .catch((e) => e);

    expect(error).toBeInstanceOf(ConflictException);
    expect(error.getResponse().code).toBe(ErrorCode.ORDER_ALREADY_PAID);
    expect(paymentGateway.createTransaction).not.toHaveBeenCalled();
  });

  it('responde 409 ORDER_EXPIRED si la orden expiró', async () => {
    orderLifecycle.isExpired.mockResolvedValue(true);

    const error = await useCase
      .execute({ claims, orderId: 'order-1' })
      .catch((e) => e);

    expect(error).toBeInstanceOf(ConflictException);
    expect(error.getResponse().code).toBe(ErrorCode.ORDER_EXPIRED);
    expect(paymentGateway.createTransaction).not.toHaveBeenCalled();
  });

  it('una orden rechazada se puede volver a pagar', async () => {
    orderRepository.getOrderById.mockResolvedValue({
      ...order,
      paymentStatus: 'REJECTED',
    });

    await expect(
      useCase.execute({ claims, orderId: 'order-1' }),
    ).resolves.toMatchObject({
      token: 'tok-1',
    });
  });

  it('si a la orden le queda poco plazo, lo extiende para cubrir el tiempo en la pasarela', async () => {
    orderRepository.getOrderById.mockResolvedValue({
      ...order,
      expirationDate: new Date(Date.now() + 60_000),
    });
    const before = Date.now();

    await useCase.execute({ claims, orderId: 'order-1' });

    const { expirationDate } = orderRepository.updateOrderById.mock.calls[0][1];
    expect(orderRepository.updateOrderById).toHaveBeenCalledWith('order-1', {
      expirationDate: expect.any(Date),
    });
    expect(expirationDate.getTime()).toBeGreaterThanOrEqual(
      before + CHECKOUT_MIN_WINDOW_MS,
    );
  });

  it('no inicia el pago de una orden en una moneda que la pasarela no acepta', async () => {
    orderRepository.getOrderById.mockResolvedValue({
      ...order,
      currency: 'USD',
    });

    await expect(
      useCase.execute({ claims, orderId: 'order-1' }),
    ).rejects.toThrow(/moneda USD/);
    expect(paymentGateway.createTransaction).not.toHaveBeenCalled();
  });

  it('si la pasarela falla propaga el error y no registra ningún intento', async () => {
    const failure = new PaymentGatewayUnavailableError(
      'Transbank create: timeout',
    );
    paymentGateway.createTransaction.mockRejectedValue(failure);

    await expect(useCase.execute({ claims, orderId: 'order-1' })).rejects.toBe(
      failure,
    );
    expect(paymentRepository.createPayment).not.toHaveBeenCalled();
  });
});
