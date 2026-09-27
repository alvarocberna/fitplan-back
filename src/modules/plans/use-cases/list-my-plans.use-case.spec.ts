import { ListMyPlansUseCase } from './list-my-plans.use-case';
import { CurrentUserResolver } from '../../identity/current-user.resolver';
import { OrderRepository } from '../../../domain/repositories/commercial-domain/order.repository';
import { FileStorage } from '../../../domain/ports';
import type { CognitoUserClaims } from '../../../common/auth/cognito-user.decorator';

describe('ListMyPlansUseCase', () => {
  let useCase: ListMyPlansUseCase;
  let orderRepository: { getPaidOrdersWithPdfByUserId: jest.Mock };
  let fileStorage: { getSignedDownloadUrl: jest.Mock };

  const claims: CognitoUserClaims = { sub: 'test-sub' };
  const creationDate = new Date('2026-01-01T00:00:00.000Z');

  beforeEach(() => {
    const currentUser = { resolve: jest.fn().mockResolvedValue({ id: 'user-1' }) };
    orderRepository = { getPaidOrdersWithPdfByUserId: jest.fn() };
    // firma distinto según la key para poder contrastar qué URL corresponde a qué objeto
    fileStorage = {
      getSignedDownloadUrl: jest.fn(async (key: string) => `https://signed-url.example/${key}`),
    };
    useCase = new ListMyPlansUseCase(
      currentUser as unknown as CurrentUserResolver,
      orderRepository as unknown as OrderRepository,
      fileStorage as unknown as FileStorage,
    );
  });

  it('devuelve las órdenes del usuario con la URL firmada de descarga del PDF (attachment) y la de la miniatura', async () => {
    orderRepository.getPaidOrdersWithPdfByUserId.mockResolvedValue([
      {
        id: 'order-1',
        creationDate,
        pdfKey: 'productos-personalizados/order-1.pdf',
        thumbnailKey: 'productos-personalizados/miniaturas/order-1.webp',
      },
    ]);

    const summaries = await useCase.execute({ claims });

    expect(orderRepository.getPaidOrdersWithPdfByUserId).toHaveBeenCalledWith('user-1');
    expect(summaries).toEqual([
      {
        orderId: 'order-1',
        creationDate,
        pdfUrl: 'https://signed-url.example/productos-personalizados/order-1.pdf',
        thumbnailUrl: 'https://signed-url.example/productos-personalizados/miniaturas/order-1.webp',
      },
    ]);
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

  it('thumbnailUrl es null (y no se firma nada) si la orden no tiene miniatura', async () => {
    orderRepository.getPaidOrdersWithPdfByUserId.mockResolvedValue([
      { id: 'order-1', creationDate, pdfKey: 'productos-personalizados/order-1.pdf', thumbnailKey: null },
    ]);

    const [summary] = await useCase.execute({ claims });

    expect(summary.thumbnailUrl).toBeNull();
    expect(summary.pdfUrl).toBe('https://signed-url.example/productos-personalizados/order-1.pdf');
    expect(fileStorage.getSignedDownloadUrl).toHaveBeenCalledTimes(1);
  });
});
