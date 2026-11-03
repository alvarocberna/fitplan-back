import { NotFoundException } from '@nestjs/common';
import { OrderLifecycleService } from './order-lifecycle.service';
import { OrderRepository } from '../../domain/repositories/commercial-domain/order.repository';
import { NutritionPlanDto } from '../../domain';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ORDER_EXPIRED } from './events/order-expired.event';

describe('OrderLifecycleService', () => {
  let service: OrderLifecycleService;
  let orderRepository: {
    getOrderWithUserById: jest.Mock;
    tryTransitionOrderToGenerating: jest.Mock;
    updateOrderById: jest.Mock;
    incrementOrderFailedAttempt: jest.Mock;
    expireOrderIfDue: jest.Mock;
    releaseStalledGenerations: jest.Mock;
    getOrderIdsPendingGeneration: jest.Mock;
  };
  let eventEmitter: { emit: jest.Mock };

  beforeEach(() => {
    orderRepository = {
      getOrderWithUserById: jest.fn(),
      tryTransitionOrderToGenerating: jest.fn(),
      updateOrderById: jest.fn(),
      incrementOrderFailedAttempt: jest.fn(),
      expireOrderIfDue: jest.fn().mockResolvedValue(false),
      releaseStalledGenerations: jest.fn().mockResolvedValue(0),
      getOrderIdsPendingGeneration: jest.fn().mockResolvedValue([]),
    };
    eventEmitter = { emit: jest.fn() };
    service = new OrderLifecycleService(
      orderRepository as unknown as OrderRepository,
      eventEmitter as unknown as EventEmitter2,
    );
  });

  it('findByIdWithUser lanza NotFoundException si el repositorio devuelve null', async () => {
    orderRepository.getOrderWithUserById.mockResolvedValue(null);
    await expect(service.findByIdWithUser('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('findByIdWithUser devuelve la orden si existe', async () => {
    orderRepository.getOrderWithUserById.mockResolvedValue({ id: 'order-1' });
    await expect(service.findByIdWithUser('order-1')).resolves.toEqual({
      id: 'order-1',
    });
  });

  it('tryStartGeneration delega el booleano del repositorio', async () => {
    orderRepository.tryTransitionOrderToGenerating.mockResolvedValue(true);
    await expect(service.tryStartGeneration('order-1')).resolves.toBe(true);
  });

  it('completeGeneration serializa el plan a JSON, marca generationStatus completado y persiste pdfKey y thumbnailKey', async () => {
    const plan = {
      prescription: { goal: 'definicion' },
    } as unknown as NutritionPlanDto;
    await service.completeGeneration(
      'order-1',
      plan,
      'productos-personalizados/order-1.pdf',
      'productos-personalizados/miniaturas/order-1.webp',
    );

    expect(orderRepository.updateOrderById).toHaveBeenCalledWith('order-1', {
      generationStatus: 'COMPLETED',
      planJson: JSON.stringify(plan),
      pdfKey: 'productos-personalizados/order-1.pdf',
      thumbnailKey: 'productos-personalizados/miniaturas/order-1.webp',
    });
  });

  it('completeGeneration persiste thumbnailKey null si la miniatura no se pudo generar', async () => {
    const plan = {
      prescription: { goal: 'definicion' },
    } as unknown as NutritionPlanDto;
    await service.completeGeneration(
      'order-1',
      plan,
      'productos-personalizados/order-1.pdf',
      null,
    );

    expect(orderRepository.updateOrderById).toHaveBeenCalledWith(
      'order-1',
      expect.objectContaining({
        generationStatus: 'COMPLETED',
        thumbnailKey: null,
      }),
    );
  });

  it('recordFailedAttempt delega en el repositorio', async () => {
    await service.recordFailedAttempt('order-1');
    expect(orderRepository.incrementOrderFailedAttempt).toHaveBeenCalledWith(
      'order-1',
    );
  });

  describe('reintentos de generación', () => {
    const NOW = new Date('2026-06-01T12:00:00.000Z');

    beforeEach(() => {
      jest.useFakeTimers().setSystemTime(NOW);
    });
    afterEach(() => {
      jest.useRealTimers();
    });

    it('releaseStalledGenerations libera las que llevan más de 30 min en GENERATING', async () => {
      orderRepository.releaseStalledGenerations.mockResolvedValue(2);

      await expect(service.releaseStalledGenerations()).resolves.toBe(2);
      expect(orderRepository.releaseStalledGenerations).toHaveBeenCalledWith(
        new Date('2026-06-01T11:30:00.000Z'),
      );
    });

    it('findOrderIdsPendingGeneration busca con las esperas de 15 min, 1 h y 4 h y 5 min de gracia para las no iniciadas', async () => {
      orderRepository.getOrderIdsPendingGeneration.mockResolvedValue([
        'order-1',
      ]);

      await expect(service.findOrderIdsPendingGeneration(5)).resolves.toEqual([
        'order-1',
      ]);
      expect(orderRepository.getOrderIdsPendingGeneration).toHaveBeenCalledWith(
        {
          notStartedPaidBefore: new Date('2026-06-01T11:55:00.000Z'),
          errorRetryDueBefore: [
            new Date('2026-06-01T11:45:00.000Z'),
            new Date('2026-06-01T11:00:00.000Z'),
            new Date('2026-06-01T08:00:00.000Z'),
          ],
          limit: 5,
        },
      );
    });
  });

  describe('expireIfDue', () => {
    it('si esta llamada expiró la orden, emite order.expired', async () => {
      orderRepository.expireOrderIfDue.mockResolvedValue(true);

      await expect(service.expireIfDue('order-1')).resolves.toBe(true);
      expect(orderRepository.expireOrderIfDue).toHaveBeenCalledWith(
        'order-1',
        expect.any(Date),
      );
      expect(eventEmitter.emit).toHaveBeenCalledWith(ORDER_EXPIRED, {
        orderId: 'order-1',
      });
    });

    it('si la orden no vencía (o ya estaba expirada/pagada), no emite nada', async () => {
      await expect(service.expireIfDue('order-1')).resolves.toBe(false);
      expect(eventEmitter.emit).not.toHaveBeenCalled();
    });
  });

  describe('isExpired', () => {
    const past = new Date(Date.now() - 60_000);
    const future = new Date(Date.now() + 60_000);

    it('EXPIRED: true sin tocar el repositorio', async () => {
      await expect(
        service.isExpired({
          id: 'order-1',
          paymentStatus: 'EXPIRED',
          expirationDate: past,
        }),
      ).resolves.toBe(true);
      expect(orderRepository.expireOrderIfDue).not.toHaveBeenCalled();
    });

    it('PAID: false aunque la fecha de expiración ya haya pasado', async () => {
      await expect(
        service.isExpired({
          id: 'order-1',
          paymentStatus: 'PAID',
          expirationDate: past,
        }),
      ).resolves.toBe(false);
      expect(orderRepository.expireOrderIfDue).not.toHaveBeenCalled();
    });

    it.each(['PENDING', 'REJECTED'] as const)(
      '%s con plazo vigente o sin plazo: false',
      async (paymentStatus) => {
        await expect(
          service.isExpired({
            id: 'order-1',
            paymentStatus,
            expirationDate: future,
          }),
        ).resolves.toBe(false);
        await expect(
          service.isExpired({
            id: 'order-1',
            paymentStatus,
            expirationDate: null,
          }),
        ).resolves.toBe(false);
        expect(orderRepository.expireOrderIfDue).not.toHaveBeenCalled();
      },
    );

    it.each(['PENDING', 'REJECTED'] as const)(
      '%s con el plazo vencido: la expira en el momento y devuelve true',
      async (paymentStatus) => {
        orderRepository.expireOrderIfDue.mockResolvedValue(true);

        await expect(
          service.isExpired({
            id: 'order-1',
            paymentStatus,
            expirationDate: past,
          }),
        ).resolves.toBe(true);
        expect(eventEmitter.emit).toHaveBeenCalledWith(ORDER_EXPIRED, {
          orderId: 'order-1',
        });
      },
    );
  });

  it('touchGeneration renueva generationUpdatedAt: marca que la generación sigue avanzando', async () => {
    orderRepository.updateOrderById.mockResolvedValue({});

    await service.touchGeneration('order-1');

    expect(orderRepository.updateOrderById).toHaveBeenCalledWith('order-1', {
      generationUpdatedAt: expect.any(Date),
    });
  });
});
