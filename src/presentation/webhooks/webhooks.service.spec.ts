import { Test, TestingModule } from '@nestjs/testing';
import { WebhooksService } from './webhooks.service';
import { OrdersService } from '../orders/orders.service';
import { PlanGenerationService } from '../plan-generation/plan-generation.service';

describe('WebhooksService', () => {
  let service: WebhooksService;
  let ordersService: jest.Mocked<OrdersService>;
  let planGenerationService: jest.Mocked<PlanGenerationService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebhooksService,
        {
          provide: OrdersService,
          useValue: { findById: jest.fn(), markAsPaid: jest.fn() },
        },
        {
          provide: PlanGenerationService,
          useValue: { generatePlan: jest.fn() },
        },
      ],
    }).compile();

    service = module.get(WebhooksService);
    ordersService = module.get(OrdersService);
    planGenerationService = module.get(PlanGenerationService);
  });

  it('verifyWebhookSignature siempre devuelve true (placeholder, sin pasarela real todavía)', () => {
    expect(service.verifyWebhookSignature()).toBe(true);
  });

  describe('processPayment', () => {
    it('caso feliz: marca la orden como pagada y dispara generatePlan sin esperarlo', async () => {
      ordersService.findById.mockResolvedValue({ id: 'order-1' } as any);
      ordersService.markAsPaid.mockResolvedValue(true);
      planGenerationService.generatePlan.mockResolvedValue(undefined);

      const result = await service.processPayment('order-1');

      expect(result).toEqual({ status: 'procesado' });
      expect(planGenerationService.generatePlan).toHaveBeenCalledWith('order-1');
    });

    it('idempotente: si la orden ya estaba pagada, no dispara generatePlan', async () => {
      ordersService.findById.mockResolvedValue({ id: 'order-1' } as any);
      ordersService.markAsPaid.mockResolvedValue(false);

      const result = await service.processPayment('order-1');

      expect(result).toEqual({ status: 'ya_procesado' });
      expect(planGenerationService.generatePlan).not.toHaveBeenCalled();
    });

    it('propaga el error de OrdersService.findById si la orden no existe (404)', async () => {
      const notFound = new Error('no encontrada');
      ordersService.findById.mockRejectedValue(notFound);

      await expect(service.processPayment('missing')).rejects.toBe(notFound);
      expect(ordersService.markAsPaid).not.toHaveBeenCalled();
    });

    it('un error inesperado en generatePlan queda contenido (no rechaza processPayment)', async () => {
      ordersService.findById.mockResolvedValue({ id: 'order-1' } as any);
      ordersService.markAsPaid.mockResolvedValue(true);
      planGenerationService.generatePlan.mockRejectedValue(new Error('fallo inesperado'));

      await expect(service.processPayment('order-1')).resolves.toEqual({ status: 'procesado' });

      // deja correr el microtask del .catch() fire-and-forget antes de terminar el test
      await new Promise((resolve) => setImmediate(resolve));
    });
  });
});
