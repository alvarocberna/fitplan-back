import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DevPaymentsController,
  PaymentsWebhookController,
} from './payments.controller';
import { ConfirmPaymentUseCase } from './use-cases/confirm-payment.use-case';
import { RejectPaymentUseCase } from './use-cases/reject-payment.use-case';
import { PaymentSimulationEnabledGuard } from './payment-simulation-enabled.guard';

describe('PaymentsWebhookController / DevPaymentsController', () => {
  let webhookController: PaymentsWebhookController;
  let devController: DevPaymentsController;
  let confirmPayment: { verifyWebhookSignature: jest.Mock; execute: jest.Mock };
  let rejectPayment: { execute: jest.Mock };

  beforeEach(async () => {
    confirmPayment = { verifyWebhookSignature: jest.fn(), execute: jest.fn() };
    rejectPayment = { execute: jest.fn() };
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PaymentsWebhookController, DevPaymentsController],
      providers: [
        { provide: ConfirmPaymentUseCase, useValue: confirmPayment },
        { provide: RejectPaymentUseCase, useValue: rejectPayment },
        { provide: ConfigService, useValue: { get: jest.fn() } },
      ],
    }).compile();

    webhookController = module.get(PaymentsWebhookController);
    devController = module.get(DevPaymentsController);
  });

  describe('POST /webhooks/payments', () => {
    it('lanza UnauthorizedException si la firma no es válida, sin procesar el pago', () => {
      confirmPayment.verifyWebhookSignature.mockReturnValue(false);

      expect(() => webhookController.receive({ orderId: 'order-1' })).toThrow(
        UnauthorizedException,
      );
      expect(confirmPayment.execute).not.toHaveBeenCalled();
    });

    it('con firma válida, delega en ConfirmPaymentUseCase con el orderId del body', async () => {
      confirmPayment.verifyWebhookSignature.mockReturnValue(true);
      confirmPayment.execute.mockResolvedValue({ status: 'processed' });

      await expect(webhookController.receive({ orderId: 'order-1' })).resolves.toEqual({
        status: 'processed',
      });
      expect(confirmPayment.execute).toHaveBeenCalledWith({ orderId: 'order-1' });
      expect(rejectPayment.execute).not.toHaveBeenCalled();
    });

    it('con status REJECTED delega en RejectPaymentUseCase, sin confirmar el pago', async () => {
      confirmPayment.verifyWebhookSignature.mockReturnValue(true);
      rejectPayment.execute.mockResolvedValue({ status: 'rejected' });

      await expect(
        webhookController.receive({ orderId: 'order-1', status: 'REJECTED' }),
      ).resolves.toEqual({ status: 'rejected' });
      expect(rejectPayment.execute).toHaveBeenCalledWith({ orderId: 'order-1' });
      expect(confirmPayment.execute).not.toHaveBeenCalled();
    });
  });

  describe('POST /dev/orders/:id/simulate-payment-rejection', () => {
    it('delega en RejectPaymentUseCase con el id de la ruta', async () => {
      rejectPayment.execute.mockResolvedValue({ status: 'rejected' });

      await expect(devController.simulateRejection('order-1')).resolves.toEqual({
        status: 'rejected',
      });
      expect(rejectPayment.execute).toHaveBeenCalledWith({ orderId: 'order-1' });
      expect(confirmPayment.execute).not.toHaveBeenCalled();
    });
  });

  describe('POST /dev/orders/:id/simulate-payment', () => {
    it('delega en ConfirmPaymentUseCase con el id de la ruta, sin validar firma', async () => {
      confirmPayment.execute.mockResolvedValue({ status: 'processed' });

      await devController.simulate('order-1');

      expect(confirmPayment.execute).toHaveBeenCalledWith({ orderId: 'order-1' });
      expect(confirmPayment.verifyWebhookSignature).not.toHaveBeenCalled();
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
