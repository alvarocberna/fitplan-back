import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DevPaymentsController, PaymentsController } from './payments.controller';
import { CommitWebpayPaymentUseCase } from './use-cases/commit-webpay-payment.use-case';
import { ConfirmPaymentUseCase } from './use-cases/confirm-payment.use-case';
import { RejectPaymentUseCase } from './use-cases/reject-payment.use-case';
import { PaymentSimulationEnabledGuard } from './payment-simulation-enabled.guard';
import { CognitoAuthGuard } from '../../common/auth/cognito-auth.guard';

describe('PaymentsController / DevPaymentsController', () => {
  let paymentsController: PaymentsController;
  let devController: DevPaymentsController;
  let commitWebpayPayment: { execute: jest.Mock };
  let confirmPayment: { execute: jest.Mock };
  let rejectPayment: { execute: jest.Mock };

  const claims = { sub: 'sub-1' };

  beforeEach(async () => {
    commitWebpayPayment = { execute: jest.fn() };
    confirmPayment = { execute: jest.fn() };
    rejectPayment = { execute: jest.fn() };
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PaymentsController, DevPaymentsController],
      providers: [
        { provide: CommitWebpayPaymentUseCase, useValue: commitWebpayPayment },
        { provide: ConfirmPaymentUseCase, useValue: confirmPayment },
        { provide: RejectPaymentUseCase, useValue: rejectPayment },
        { provide: ConfigService, useValue: { get: jest.fn() } },
      ],
    })
      .overrideGuard(CognitoAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    paymentsController = module.get(PaymentsController);
    devController = module.get(DevPaymentsController);
  });

  describe('POST /payments/webpay/commit', () => {
    it('delega en CommitWebpayPaymentUseCase con los parámetros de retorno de Webpay', async () => {
      const result = { orderId: 'order-1', productType: 'GENERATED', outcome: 'paid' };
      commitWebpayPayment.execute.mockResolvedValue(result);

      await expect(paymentsController.commitWebpay({ tokenWs: 'tok-1' })).resolves.toEqual(
        result,
      );
      expect(commitWebpayPayment.execute).toHaveBeenCalledWith({ tokenWs: 'tok-1' });
      expect(confirmPayment.execute).not.toHaveBeenCalled();
    });
  });

  describe('POST /dev/orders/:id/simulate-payment-rejection', () => {
    it('delega en RejectPaymentUseCase con el id de la ruta y el usuario del token', async () => {
      rejectPayment.execute.mockResolvedValue({ status: 'rejected' });

      await expect(devController.simulateRejection('order-1', claims)).resolves.toEqual({
        status: 'rejected',
      });
      expect(rejectPayment.execute).toHaveBeenCalledWith({ orderId: 'order-1', claims });
      expect(confirmPayment.execute).not.toHaveBeenCalled();
    });
  });

  describe('POST /dev/orders/:id/simulate-payment', () => {
    it('delega en ConfirmPaymentUseCase con el id de la ruta y el usuario del token', async () => {
      confirmPayment.execute.mockResolvedValue({ status: 'processed' });

      await devController.simulate('order-1', claims);

      expect(confirmPayment.execute).toHaveBeenCalledWith({ orderId: 'order-1', claims });
    });
  });
});

describe('PaymentSimulationEnabledGuard', () => {
  const guardWith = (value: string | undefined) =>
    new PaymentSimulationEnabledGuard({
      get: jest.fn().mockReturnValue(value),
    } as unknown as ConfigService);

  it('deja pasar con ENABLE_PAYMENT_SIMULATION=true', () => {
    expect(guardWith('true').canActivate()).toBe(true);
  });

  it.each([undefined, 'false', ''])('responde 404 con ENABLE_PAYMENT_SIMULATION=%p', (value) => {
    expect(() => guardWith(value).canActivate()).toThrow(NotFoundException);
  });
});
