import { Test, TestingModule } from '@nestjs/testing';
import { OrdersController } from './orders.controller';
import { GetOrderStatusUseCase } from './use-cases/get-order-status.use-case';
import type { CognitoUserClaims } from '../../common/auth/cognito-user.decorator';

describe('OrdersController', () => {
  let controller: OrdersController;
  let getOrderStatus: { execute: jest.Mock };

  beforeEach(async () => {
    getOrderStatus = { execute: jest.fn() };
    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrdersController],
      providers: [{ provide: GetOrderStatusUseCase, useValue: getOrderStatus }],
    }).compile();

    controller = module.get(OrdersController);
  });

  it('status() delega en GetOrderStatusUseCase con el id y los claims recibidos', async () => {
    const claims: CognitoUserClaims = { sub: 'test-sub' };
    getOrderStatus.execute.mockResolvedValue({
      paymentStatus: 'PAID',
      generationStatus: 'COMPLETED',
      planJson: null,
      pdfUrl: null,
      thumbnailUrl: null,
    });

    const result = await controller.status('11111111-1111-4111-8111-111111111111', claims);

    expect(result.paymentStatus).toBe('PAID');
    expect(getOrderStatus.execute).toHaveBeenCalledWith({
      claims,
      orderId: '11111111-1111-4111-8111-111111111111',
    });
  });
});
