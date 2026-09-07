import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { WebhooksController } from './webhooks.controller';
import { WebhooksService } from './webhooks.service';
import { WebhookPagoDtoImpl } from './dto/webhook-pago.dto';

describe('WebhooksController', () => {
  let controller: WebhooksController;
  let service: jest.Mocked<WebhooksService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [WebhooksController],
      providers: [
        {
          provide: WebhooksService,
          useValue: {
            verifyWebhookSignature: jest.fn(),
            processPayment: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get(WebhooksController);
    service = module.get(WebhooksService);
  });

  describe('receivePaymentWebhook', () => {
    it('lanza UnauthorizedException si la firma no es válida, sin procesar el pago', () => {
      service.verifyWebhookSignature.mockReturnValue(false);
      const body: WebhookPagoDtoImpl = { orden_id: 'order-1' } as WebhookPagoDtoImpl;

      expect(() => controller.receivePaymentWebhook(body)).toThrow(UnauthorizedException);
      expect(service.processPayment).not.toHaveBeenCalled();
    });

    it('con firma válida, delega en processPayment con el orden_id', () => {
      service.verifyWebhookSignature.mockReturnValue(true);
      service.processPayment.mockResolvedValue({ status: 'procesado' });
      const body: WebhookPagoDtoImpl = { orden_id: 'order-1' } as WebhookPagoDtoImpl;

      controller.receivePaymentWebhook(body);

      expect(service.processPayment).toHaveBeenCalledWith('order-1');
    });
  });

  describe('simulatePayment', () => {
    it('delega en processPayment con el id de la ruta, sin validar firma', () => {
      service.processPayment.mockResolvedValue({ status: 'procesado' });

      controller.simulatePayment('order-1');

      expect(service.processPayment).toHaveBeenCalledWith('order-1');
      expect(service.verifyWebhookSignature).not.toHaveBeenCalled();
    });
  });
});
