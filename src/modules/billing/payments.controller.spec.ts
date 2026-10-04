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
import { PaymentWebhookVerifier } from './payment-webhook-verifier';
import { CognitoAuthGuard } from '../../common/auth/cognito-auth.guard';

describe('PaymentsWebhookController / DevPaymentsController', () => {
  let webhookController: PaymentsWebhookController;
  let devController: DevPaymentsController;
  let confirmPayment: { execute: jest.Mock };
  let rejectPayment: { execute: jest.Mock };
  let webhookVerifier: { isValid: jest.Mock };

  const claims = { sub: 'sub-1' };

  beforeEach(async () => {
    confirmPayment = { execute: jest.fn() };
    rejectPayment = { execute: jest.fn() };
    webhookVerifier = { isValid: jest.fn() };
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PaymentsWebhookController, DevPaymentsController],
      providers: [
        { provide: ConfirmPaymentUseCase, useValue: confirmPayment },
        { provide: RejectPaymentUseCase, useValue: rejectPayment },
        { provide: PaymentWebhookVerifier, useValue: webhookVerifier },
        { provide: ConfigService, useValue: { get: jest.fn() } },
      ],
    })
      .overrideGuard(CognitoAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    webhookController = module.get(PaymentsWebhookController);
    devController = module.get(DevPaymentsController);
  });

  describe('POST /webhooks/payments', () => {
    it('lanza UnauthorizedException si el secreto no es válido, sin procesar el pago', () => {
      webhookVerifier.isValid.mockReturnValue(false);

      expect(() => webhookController.receive({ orderId: 'order-1' }, 'malo')).toThrow(
        UnauthorizedException,
      );
      expect(webhookVerifier.isValid).toHaveBeenCalledWith('malo');
      expect(confirmPayment.execute).not.toHaveBeenCalled();
      expect(rejectPayment.execute).not.toHaveBeenCalled();
    });

    it('con el secreto válido, delega en ConfirmPaymentUseCase con el orderId del body (sin claims)', async () => {
      webhookVerifier.isValid.mockReturnValue(true);
      confirmPayment.execute.mockResolvedValue({ status: 'processed' });

      await expect(
        webhookController.receive({ orderId: 'order-1' }, 'secreto'),
      ).resolves.toEqual({ status: 'processed' });
      expect(confirmPayment.execute).toHaveBeenCalledWith({ orderId: 'order-1' });
      expect(rejectPayment.execute).not.toHaveBeenCalled();
    });

    it('con status REJECTED delega en RejectPaymentUseCase, sin confirmar el pago', async () => {
      webhookVerifier.isValid.mockReturnValue(true);
      rejectPayment.execute.mockResolvedValue({ status: 'rejected' });

      await expect(
        webhookController.receive({ orderId: 'order-1', status: 'REJECTED' }, 'secreto'),
      ).resolves.toEqual({ status: 'rejected' });
      expect(rejectPayment.execute).toHaveBeenCalledWith({ orderId: 'order-1' });
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
    it('delega en ConfirmPaymentUseCase con el id de la ruta y el usuario del token, sin secreto de webhook', async () => {
      confirmPayment.execute.mockResolvedValue({ status: 'processed' });

      await devController.simulate('order-1', claims);

      expect(confirmPayment.execute).toHaveBeenCalledWith({ orderId: 'order-1', claims });
      expect(webhookVerifier.isValid).not.toHaveBeenCalled();
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

describe('PaymentWebhookVerifier', () => {
  const verifierWith = (secret: string | undefined) =>
    new PaymentWebhookVerifier({
      get: jest.fn().mockReturnValue(secret),
    } as unknown as ConfigService);

  it('acepta el header que coincide con PAYMENT_WEBHOOK_SECRET', () => {
    expect(verifierWith('s3creto-largo').isValid('s3creto-largo')).toBe(true);
  });

  it.each([['otro'], ['s3creto-larg'], ['s3creto-largo '], [''], [undefined], [['s3creto-largo']]])(
    'rechaza %p',
    (header) => {
      expect(verifierWith('s3creto-largo').isValid(header)).toBe(false);
    },
  );

  it.each([undefined, ''])('falla cerrado sin secreto configurado (%p)', (secret) => {
    expect(verifierWith(secret).isValid('cualquiera')).toBe(false);
    expect(verifierWith(secret).isValid('')).toBe(false);
  });
});
