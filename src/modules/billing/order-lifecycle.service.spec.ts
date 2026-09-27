import { NotFoundException } from '@nestjs/common';
import { OrderLifecycleService } from './order-lifecycle.service';
import { OrderRepository } from '../../domain/repositories/commercial-domain/order.repository';
import { NutritionPlanDto } from '../../domain';

describe('OrderLifecycleService', () => {
  let service: OrderLifecycleService;
  let orderRepository: {
    getOrderWithUserById: jest.Mock;
    tryTransitionOrderToGenerating: jest.Mock;
    updateOrderById: jest.Mock;
    incrementOrderFailedAttempt: jest.Mock;
  };

  beforeEach(() => {
    orderRepository = {
      getOrderWithUserById: jest.fn(),
      tryTransitionOrderToGenerating: jest.fn(),
      updateOrderById: jest.fn(),
      incrementOrderFailedAttempt: jest.fn(),
    };
    service = new OrderLifecycleService(orderRepository as unknown as OrderRepository);
  });

  it('findByIdWithUser lanza NotFoundException si el repositorio devuelve null', async () => {
    orderRepository.getOrderWithUserById.mockResolvedValue(null);
    await expect(service.findByIdWithUser('missing')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('findByIdWithUser devuelve la orden si existe', async () => {
    orderRepository.getOrderWithUserById.mockResolvedValue({ id: 'order-1' });
    await expect(service.findByIdWithUser('order-1')).resolves.toEqual({ id: 'order-1' });
  });

  it('tryStartGeneration delega el booleano del repositorio', async () => {
    orderRepository.tryTransitionOrderToGenerating.mockResolvedValue(true);
    await expect(service.tryStartGeneration('order-1')).resolves.toBe(true);
  });

  it('completeGeneration serializa el plan a JSON, marca generationStatus completado y persiste pdfKey y thumbnailKey', async () => {
    const plan = { prescription: { goal: 'definicion' } } as unknown as NutritionPlanDto;
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
    const plan = { prescription: { goal: 'definicion' } } as unknown as NutritionPlanDto;
    await service.completeGeneration('order-1', plan, 'productos-personalizados/order-1.pdf', null);

    expect(orderRepository.updateOrderById).toHaveBeenCalledWith(
      'order-1',
      expect.objectContaining({ generationStatus: 'COMPLETED', thumbnailKey: null }),
    );
  });

  it('recordFailedAttempt delega en el repositorio', async () => {
    await service.recordFailedAttempt('order-1');
    expect(orderRepository.incrementOrderFailedAttempt).toHaveBeenCalledWith('order-1');
  });
});
