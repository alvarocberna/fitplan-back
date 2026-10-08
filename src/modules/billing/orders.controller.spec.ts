import { Test, TestingModule } from '@nestjs/testing';
import { OrdersController } from './orders.controller';
import { GetOrderStatusUseCase } from './use-cases/get-order-status.use-case';
import { StartPaymentUseCase } from './use-cases/start-payment.use-case';
import { CognitoAuthGuard } from '../../common/auth/cognito-auth.guard';
import type { CognitoUserClaims } from '../../common/auth/cognito-user.decorator';

describe('OrdersController', () => {
  let controller: OrdersController;
  let getOrderStatus: { execute: jest.Mock };
  let startPayment: { execute: jest.Mock };

  const claims: CognitoUserClaims = { sub: 'test-sub' };
  const orderId = '11111111-1111-4111-8111-111111111111';

  beforeEach(async () => {
    getOrderStatus = { execute: jest.fn() };
    startPayment = { execute: jest.fn() };
    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrdersController],
      providers: [
        { provide: GetOrderStatusUseCase, useValue: getOrderStatus },
        { provide: StartPaymentUseCase, useValue: startPayment },
      ],
    })
      .overrideGuard(CognitoAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(OrdersController);
  });

  it('status() delega en GetOrderStatusUseCase con el id y los claims recibidos', async () => {
    getOrderStatus.execute.mockResolvedValue({
      paymentStatus: 'PAID',
      generationStatus: 'COMPLETED',
      planJson: null,
      pdfUrl: null,
      thumbnailUrl: null,
    });

    const result = await controller.status(orderId, claims);

    expect(result.paymentStatus).toBe('PAID');
    expect(getOrderStatus.execute).toHaveBeenCalledWith({ claims, orderId });
  });

  it('pay() delega en StartPaymentUseCase con el id y los claims recibidos', async () => {
    const started = { url: 'https://webpay.test/init', token: 'tok-1' };
    startPayment.execute.mockResolvedValue(started);

    await expect(controller.pay(orderId, claims)).resolves.toEqual(started);
    expect(startPayment.execute).toHaveBeenCalledWith({ claims, orderId });
  });
});
