import { NotFoundException } from '@nestjs/common';
import { GetOrderStatusUseCase } from './get-order-status.use-case';
import { CurrentUserResolver } from '../../identity/current-user.resolver';
import { OrderRepository } from '../../../domain/repositories/commercial-domain/order.repository';
import { FileStorage } from '../../../domain/ports';
import type { CognitoUserClaims } from '../../../common/auth/cognito-user.decorator';

describe('GetOrderStatusUseCase', () => {
  let useCase: GetOrderStatusUseCase;
  let currentUser: { resolve: jest.Mock };
  let orderRepository: { getOrderById: jest.Mock };
  let fileStorage: { getSignedDownloadUrl: jest.Mock };

  const claims: CognitoUserClaims = { sub: 'test-sub' };

  beforeEach(() => {
    currentUser = { resolve: jest.fn().mockResolvedValue({ id: 'user-1' }) };
    orderRepository = { getOrderById: jest.fn() };
    // firma distinto según la key para poder contrastar qué URL corresponde a qué objeto
    fileStorage = {
      getSignedDownloadUrl: jest.fn(async (key: string) => `https://signed-url.example/${key}`),
    };
    useCase = new GetOrderStatusUseCase(
      currentUser as unknown as CurrentUserResolver,
      orderRepository as unknown as OrderRepository,
      fileStorage as unknown as FileStorage,
    );
  });

  it('devuelve el estado público, parseando planJson, con la URL firmada de descarga del PDF y la de la miniatura', async () => {
    orderRepository.getOrderById.mockResolvedValue({
      userId: 'user-1',
      paymentStatus: 'PAID',
      generationStatus: 'COMPLETED',
      planJson: JSON.stringify({ prescription: { goal: 'volumen' } }),
      pdfKey: 'productos-personalizados/order-1.pdf',
      thumbnailKey: 'productos-personalizados/miniaturas/order-1.webp',
      creationDate: new Date('2026-01-01T00:00:00.000Z'),
    });

    const status = await useCase.execute({ claims, orderId: 'order-1' });

    expect(currentUser.resolve).toHaveBeenCalledWith(claims);
    expect(status.paymentStatus).toBe('PAID');
    expect(status.generationStatus).toBe('COMPLETED');
    expect((status.planJson as any).prescription.goal).toBe('volumen');
    expect(status.pdfUrl).toBe('https://signed-url.example/productos-personalizados/order-1.pdf');
    expect(status.thumbnailUrl).toBe(
      'https://signed-url.example/productos-personalizados/miniaturas/order-1.webp',
    );
    // solo el PDF se firma como descarga, con nombre de archivo basado en la fecha de creación
    expect(fileStorage.getSignedDownloadUrl).toHaveBeenCalledWith(
      'productos-personalizados/order-1.pdf',
      undefined,
      { downloadFilename: 'plan-nutricional-2026-01-01.pdf' },
    );
    expect(fileStorage.getSignedDownloadUrl).toHaveBeenCalledWith(
      'productos-personalizados/miniaturas/order-1.webp',
    );
  });

  it('devuelve thumbnailUrl null (y firma solo el PDF) si el plan está listo pero no tiene miniatura', async () => {
    orderRepository.getOrderById.mockResolvedValue({
      userId: 'user-1',
      paymentStatus: 'PAID',
      generationStatus: 'COMPLETED',
      planJson: null,
      pdfKey: 'productos-personalizados/order-1.pdf',
      thumbnailKey: null,
      creationDate: new Date('2026-01-01T00:00:00.000Z'),
    });

    const status = await useCase.execute({ claims, orderId: 'order-1' });

    expect(status.thumbnailUrl).toBeNull();
    expect(fileStorage.getSignedDownloadUrl).toHaveBeenCalledTimes(1);
  });

  it('devuelve planJson, pdfUrl y thumbnailUrl null si aún no hay plan', async () => {
    orderRepository.getOrderById.mockResolvedValue({
      userId: 'user-1',
      paymentStatus: 'PENDING',
      generationStatus: 'NOT_STARTED',
      planJson: null,
      pdfKey: null,
      thumbnailKey: null,
      creationDate: new Date('2026-01-01T00:00:00.000Z'),
    });

    const status = await useCase.execute({ claims, orderId: 'order-1' });

    expect(status.planJson).toBeNull();
    expect(status.pdfUrl).toBeNull();
    expect(status.thumbnailUrl).toBeNull();
    expect(fileStorage.getSignedDownloadUrl).not.toHaveBeenCalled();
  });

  it('lanza NotFoundException si la orden pertenece a otro usuario (BOLA)', async () => {
    orderRepository.getOrderById.mockResolvedValue({ userId: 'otro-usuario' });

    await expect(useCase.execute({ claims, orderId: 'order-1' })).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('lanza NotFoundException si la orden no existe', async () => {
    orderRepository.getOrderById.mockResolvedValue(null);

    await expect(useCase.execute({ claims, orderId: 'missing' })).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
