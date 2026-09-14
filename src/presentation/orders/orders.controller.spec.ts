import { Test, TestingModule } from '@nestjs/testing';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { CompleteConsultationDtoImpl } from '../consultation/dto/consultation.dto';
import type { CognitoUserClaims } from '../auth/cognito-user.decorator';

describe('OrdersController', () => {
  let controller: OrdersController;
  let service: jest.Mocked<OrdersService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrdersController],
      providers: [
        {
          provide: OrdersService,
          useValue: {
            createOrder: jest.fn(),
            getStatus: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get(OrdersController);
    service = module.get(OrdersService);
  });

  it('create() delega en OrdersService.createOrder y devuelve su resultado', async () => {
    const dto = { personalInfo: { email: 'a@b.com' } } as unknown as CompleteConsultationDtoImpl;
    const cognitoUser: CognitoUserClaims = { sub: 'test-sub' };
    service.createOrder.mockResolvedValue({ orderId: 'order-1' });

    await expect(controller.create(dto, cognitoUser)).resolves.toEqual({ orderId: 'order-1' });
    expect(service.createOrder).toHaveBeenCalledWith(dto, cognitoUser);
  });

  it('getStatus() delega en OrdersService.getStatus con el id recibido', async () => {
    service.getStatus.mockResolvedValue({
      paymentStatus: 'pagado',
      generationStatus: 'completado',
      planJson: null,
    });

    const result = await controller.getStatus('11111111-1111-4111-8111-111111111111');

    expect(result.paymentStatus).toBe('pagado');
    expect(service.getStatus).toHaveBeenCalledWith('11111111-1111-4111-8111-111111111111');
  });
});
