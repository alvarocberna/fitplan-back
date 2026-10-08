import { ConflictException, NotFoundException } from '@nestjs/common';
import { CommitWebpayPaymentUseCase } from './commit-webpay-payment.use-case';
import { ConfirmPaymentUseCase } from './confirm-payment.use-case';
import { RejectPaymentUseCase } from './reject-payment.use-case';
import { AlertNotifier, PaymentGateway } from '../../../domain/ports';
import { PaymentGatewayUnavailableError } from '../../../domain/errors/payment.errors';
import { OrderRepository } from '../../../domain/repositories/commercial-domain/order.repository';
import { PaymentRepository } from '../../../domain/repositories/commercial-domain/payment.repository';
import { OrderLifecycleService } from '../order-lifecycle.service';

describe('CommitWebpayPaymentUseCase', () => {
  let useCase: CommitWebpayPaymentUseCase;
  let orderRepository: { getOrderWithProductById: jest.Mock };
  let paymentRepository: {
    getPaymentByToken: jest.Mock;
    getPaymentByIdentifier: jest.Mock;
    getPaymentById: jest.Mock;
    closeInitiatedPayment: jest.Mock;
  };
  let orderLifecycle: { isExpired: jest.Mock };
  let paymentGateway: {
    commitTransaction: jest.Mock;
    getTransactionStatus: jest.Mock;
  };
  let confirmPayment: { execute: jest.Mock };
  let rejectPayment: { execute: jest.Mock };
  let alertNotifier: { notify: jest.Mock };

  const payment = {
    id: 'payment-1',
    orderId: 'order-1',
    provider: 'TRANSBANK',
    paymentIdentifier: 'buy-order-1',
    token: 'tok-1',
    amount: 19990,
    status: 'INITIATED',
  };
  const order = {
    id: 'order-1',
    userId: 'user-1',
    amount: 19990,
    paymentStatus: 'PENDING',
    product: { id: 'product-1', type: 'GENERATED' },
  };
  const authorized = {
    approved: true,
    status: 'AUTHORIZED',
    responseCode: 0,
    buyOrder: 'buy-order-1',
    amount: 19990,
    authorizationCode: '1213',
    paymentTypeCode: 'VN',
    installmentCount: 0,
    cardLastDigits: '6623',
    transactionDate: new Date('2026-10-07T12:00:00Z'),
  };
  const failed = {
    ...authorized,
    approved: false,
    status: 'FAILED',
    responseCode: -1,
  };

  beforeEach(() => {
    orderRepository = {
      getOrderWithProductById: jest.fn().mockResolvedValue(order),
    };
    paymentRepository = {
      getPaymentByToken: jest.fn().mockResolvedValue(payment),
      getPaymentByIdentifier: jest.fn().mockResolvedValue(payment),
      getPaymentById: jest.fn().mockResolvedValue(payment),
      closeInitiatedPayment: jest.fn().mockResolvedValue(true),
    };
    orderLifecycle = { isExpired: jest.fn().mockResolvedValue(false) };
    paymentGateway = {
      commitTransaction: jest.fn().mockResolvedValue(authorized),
      getTransactionStatus: jest.fn(),
    };
    confirmPayment = {
      execute: jest.fn().mockResolvedValue({ status: 'processed' }),
    };
    rejectPayment = {
      execute: jest.fn().mockResolvedValue({ status: 'rejected' }),
    };
    alertNotifier = { notify: jest.fn().mockResolvedValue(undefined) };
    useCase = new CommitWebpayPaymentUseCase(
      orderRepository as unknown as OrderRepository,
      paymentRepository as unknown as PaymentRepository,
      orderLifecycle as unknown as OrderLifecycleService,
      paymentGateway as unknown as PaymentGateway,
      confirmPayment as unknown as ConfirmPaymentUseCase,
      rejectPayment as unknown as RejectPaymentUseCase,
      alertNotifier,
    );
  });

  describe('ubicar el intento', () => {
    it.each([
      ['sin parámetros', {}],
      ['con un token desconocido', { tokenWs: 'otro' }],
    ])('responde 404 %s', async (_name, input) => {
      paymentRepository.getPaymentByToken.mockResolvedValue(null);

      await expect(useCase.execute(input)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(paymentGateway.commitTransaction).not.toHaveBeenCalled();
    });

    it('responde 404 si el pago no es de la pasarela (pago simulado)', async () => {
      paymentRepository.getPaymentByToken.mockResolvedValue({
        ...payment,
        provider: 'SIMULATED',
      });

      await expect(
        useCase.execute({ tokenWs: 'tok-1' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('pago aprobado', () => {
    it('confirma en la pasarela y paga la orden con el resultado de Webpay', async () => {
      await expect(useCase.execute({ tokenWs: 'tok-1' })).resolves.toEqual({
        orderId: 'order-1',
        productType: 'GENERATED',
        outcome: 'paid',
      });

      expect(paymentGateway.commitTransaction).toHaveBeenCalledWith('tok-1');
      expect(confirmPayment.execute).toHaveBeenCalledWith({
        orderId: 'order-1',
        payment: {
          paymentId: 'payment-1',
          result: {
            provider: 'TRANSBANK',
            paymentIdentifier: 'buy-order-1',
            amount: 19990,
            status: 'AUTHORIZED',
            responseCode: 0,
            authorizationCode: '1213',
            installmentCount: 0,
            transactionDate: authorized.transactionDate,
            movementType: 'VN',
            cardType: 'CREDIT',
            cardLastDigits: '6623',
          },
        },
      });
      expect(rejectPayment.execute).not.toHaveBeenCalled();
      expect(alertNotifier.notify).not.toHaveBeenCalled();
    });

    it.each([
      ['VD', 'DEBIT'],
      ['VP', 'PREPAID'],
      ['NC', 'CREDIT'],
    ])(
      'el tipo de pago %s se registra como tarjeta %s',
      async (paymentTypeCode, cardType) => {
        paymentGateway.commitTransaction.mockResolvedValue({
          ...authorized,
          paymentTypeCode,
        });

        await useCase.execute({ tokenWs: 'tok-1' });

        expect(
          confirmPayment.execute.mock.calls[0][0].payment.result.cardType,
        ).toBe(cardType);
      },
    );

    it('un monto distinto al del intento no se da por aprobado', async () => {
      paymentGateway.commitTransaction.mockResolvedValue({
        ...authorized,
        amount: 1,
      });

      await expect(
        useCase.execute({ tokenWs: 'tok-1' }),
      ).resolves.toMatchObject({
        outcome: 'rejected',
      });
      expect(confirmPayment.execute).not.toHaveBeenCalled();
    });

    it('si la orden de compra de Webpay no coincide, alerta y falla sin pagar la orden', async () => {
      paymentGateway.commitTransaction.mockResolvedValue({
        ...authorized,
        buyOrder: 'otra',
      });

      await expect(useCase.execute({ tokenWs: 'tok-1' })).rejects.toThrow(
        /no coincide/,
      );
      expect(alertNotifier.notify).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'payment_mismatch',
          severity: 'critical',
        }),
      );
      expect(confirmPayment.execute).not.toHaveBeenCalled();
    });
  });

  describe('idempotencia', () => {
    it.each([
      ['AUTHORIZED', 'paid'],
      ['REJECTED', 'rejected'],
      ['CANCELLED', 'cancelled'],
    ])(
      'un intento ya cerrado como %s responde %s sin llamar a la pasarela',
      async (status, outcome) => {
        paymentRepository.getPaymentByToken.mockResolvedValue({
          ...payment,
          status,
        });

        await expect(
          useCase.execute({ tokenWs: 'tok-1' }),
        ).resolves.toMatchObject({ outcome });
        expect(paymentGateway.commitTransaction).not.toHaveBeenCalled();
        expect(confirmPayment.execute).not.toHaveBeenCalled();
        expect(rejectPayment.execute).not.toHaveBeenCalled();
      },
    );

    it('si el commit falla porque ya se había confirmado, usa el estado que informa la pasarela', async () => {
      paymentGateway.commitTransaction.mockRejectedValue(
        new PaymentGatewayUnavailableError('Transbank commit: 422'),
      );
      paymentGateway.getTransactionStatus.mockResolvedValue(authorized);

      await expect(
        useCase.execute({ tokenWs: 'tok-1' }),
      ).resolves.toMatchObject({
        outcome: 'paid',
      });
      expect(paymentGateway.getTransactionStatus).toHaveBeenCalledWith('tok-1');
    });

    it('si el commit falla y la transacción sigue sin pagar, propaga el error de la pasarela', async () => {
      const failure = new PaymentGatewayUnavailableError(
        'Transbank commit: timeout',
      );
      paymentGateway.commitTransaction.mockRejectedValue(failure);
      paymentGateway.getTransactionStatus.mockResolvedValue({
        ...failed,
        status: 'INITIALIZED',
      });

      await expect(useCase.execute({ tokenWs: 'tok-1' })).rejects.toBe(failure);
      expect(confirmPayment.execute).not.toHaveBeenCalled();
      expect(paymentRepository.closeInitiatedPayment).not.toHaveBeenCalled();
    });

    it('dos retornos a la vez: el que no marcó la orden responde paid si el otro cerró el mismo intento', async () => {
      confirmPayment.execute.mockResolvedValue({ status: 'already_processed' });
      paymentRepository.getPaymentById.mockResolvedValue({
        ...payment,
        status: 'AUTHORIZED',
      });

      await expect(
        useCase.execute({ tokenWs: 'tok-1' }),
      ).resolves.toMatchObject({
        outcome: 'paid',
      });
      expect(alertNotifier.notify).not.toHaveBeenCalled();
    });
  });

  describe('pago rechazado', () => {
    beforeEach(() => {
      paymentGateway.commitTransaction.mockResolvedValue(failed);
    });

    it('registra el rechazo en la orden y no la paga', async () => {
      await expect(
        useCase.execute({ tokenWs: 'tok-1' }),
      ).resolves.toMatchObject({
        outcome: 'rejected',
      });

      expect(rejectPayment.execute).toHaveBeenCalledWith({
        orderId: 'order-1',
        payment: {
          paymentId: 'payment-1',
          result: expect.objectContaining({
            status: 'REJECTED',
            responseCode: -1,
          }),
        },
      });
      expect(confirmPayment.execute).not.toHaveBeenCalled();
      expect(paymentRepository.closeInitiatedPayment).not.toHaveBeenCalled();
    });

    it('si la orden ya no admite pagos, igual cierra el intento como rechazado', async () => {
      rejectPayment.execute.mockRejectedValue(
        new ConflictException('La orden expiró sin pagarse'),
      );

      await expect(
        useCase.execute({ tokenWs: 'tok-1' }),
      ).resolves.toMatchObject({
        outcome: 'rejected',
      });
      expect(paymentRepository.closeInitiatedPayment).toHaveBeenCalledWith(
        'payment-1',
        expect.objectContaining({ status: 'REJECTED' }),
      );
    });
  });

  describe('pago anulado o abandonado', () => {
    it.each([
      [
        'anulado en el formulario (TBK_TOKEN)',
        { tbkToken: 'tok-1', tbkBuyOrder: 'buy-order-1' },
      ],
      [
        'formulario vencido (solo TBK_ORDEN_COMPRA)',
        { tbkBuyOrder: 'buy-order-1' },
      ],
      [
        'error en el formulario (token_ws y TBK_TOKEN)',
        { tokenWs: 'tok-1', tbkToken: 'tok-1' },
      ],
    ])(
      '%s: cierra el intento como CANCELLED sin tocar la orden',
      async (_name, input) => {
        await expect(useCase.execute(input)).resolves.toMatchObject({
          outcome: 'cancelled',
        });

        expect(paymentRepository.closeInitiatedPayment).toHaveBeenCalledWith(
          'payment-1',
          {
            status: 'CANCELLED',
          },
        );
        expect(paymentGateway.commitTransaction).not.toHaveBeenCalled();
        expect(confirmPayment.execute).not.toHaveBeenCalled();
        expect(rejectPayment.execute).not.toHaveBeenCalled();
      },
    );

    it('el formulario vencido se ubica por la orden de compra', async () => {
      await useCase.execute({ tbkBuyOrder: 'buy-order-1' });

      expect(paymentRepository.getPaymentByIdentifier).toHaveBeenCalledWith(
        'buy-order-1',
      );
    });
  });

  describe('orden que ya no admite el pago', () => {
    it.each([
      [
        'ya pagada por otro intento',
        { ...order, paymentStatus: 'PAID' },
        false,
      ],
      ['expirada', order, true],
    ])(
      '%s: no confirma la transacción y avisa',
      async (_name, found, expired) => {
        orderRepository.getOrderWithProductById.mockResolvedValue(found);
        orderLifecycle.isExpired.mockResolvedValue(expired);

        await expect(
          useCase.execute({ tokenWs: 'tok-1' }),
        ).resolves.toMatchObject({
          outcome: 'not_committed',
        });

        expect(paymentGateway.commitTransaction).not.toHaveBeenCalled();
        expect(paymentRepository.closeInitiatedPayment).toHaveBeenCalledWith(
          'payment-1',
          {
            status: 'CANCELLED',
          },
        );
        expect(alertNotifier.notify).toHaveBeenCalledWith(
          expect.objectContaining({
            event: 'payment_not_committed',
            severity: 'warning',
          }),
        );
      },
    );

    it.each([
      [
        'la pagó otro intento',
        () => Promise.resolve({ status: 'already_processed' }),
      ],
      [
        'expiró',
        () =>
          Promise.reject(new ConflictException('La orden expiró sin pagarse')),
      ],
    ])(
      'cobro confirmado que no se aplica porque la orden %s: lo registra y lanza alerta crítica',
      async (_name, confirmResult) => {
        confirmPayment.execute.mockImplementation(confirmResult);

        await expect(
          useCase.execute({ tokenWs: 'tok-1' }),
        ).resolves.toMatchObject({
          outcome: 'needs_review',
        });

        expect(paymentRepository.closeInitiatedPayment).toHaveBeenCalledWith(
          'payment-1',
          expect.objectContaining({
            status: 'AUTHORIZED',
            authorizationCode: '1213',
          }),
        );
        expect(alertNotifier.notify).toHaveBeenCalledWith(
          expect.objectContaining({
            event: 'payment_charged_not_applied',
            severity: 'critical',
          }),
        );
      },
    );
  });
});
