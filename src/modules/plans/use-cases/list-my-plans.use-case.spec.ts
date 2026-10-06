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
  const paymentDate = new Date('2026-01-02T10:00:00.000Z');

  const generatedOrder = {
    id: 'order-1',
    creationDate,
    paymentDate,
    pdfKey: 'productos-personalizados/order-1.pdf',
    thumbnailKey: 'productos-personalizados/miniaturas/order-1.webp',
    product: { type: 'GENERATED', name: 'Plan Nutricional Personalizado' },
    plan: {
      nutritionalPlans: [
        {
          planName: 'Plan personalizado',
          goal: 'definicion',
          dietRegimen: 'Hipocalórico',
          calorieIntake: 2000,
          proteinIntake: 150,
          carbohydrateIntake: 200,
          lipidIntake: 60,
        },
      ],
    },
  };

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

  it('devuelve cada plan personalizado con nombre, tipo, fecha de compra, resumen y URLs firmadas', async () => {
    orderRepository.getPaidOrdersWithPdfByUserId.mockResolvedValue([generatedOrder]);

    const summaries = await useCase.execute({ claims });

    expect(orderRepository.getPaidOrdersWithPdfByUserId).toHaveBeenCalledWith('user-1');
    expect(summaries).toEqual([
      {
        orderId: 'order-1',
        type: 'GENERATED',
        name: 'Plan personalizado',
        purchasedAt: '2026-01-02T10:00:00.000Z',
        pdfUrl: 'https://signed-url.example/productos-personalizados/order-1.pdf',
        thumbnailUrl: 'https://signed-url.example/productos-personalizados/miniaturas/order-1.webp',
        summary: {
          goal: 'definicion',
          dietRegimen: 'Hipocalórico',
          calorieIntake: 2000,
          proteinIntake: 150,
          carbohydrateIntake: 200,
          lipidIntake: 60,
        },
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

  it('un plan personalizado sin NutritionalPlan usa el nombre del producto, resumen null y la fecha de creación si no hay de pago', async () => {
    orderRepository.getPaidOrdersWithPdfByUserId.mockResolvedValue([
      { ...generatedOrder, paymentDate: null, thumbnailKey: null, plan: null },
    ]);

    const [summary] = await useCase.execute({ claims });

    expect(summary.name).toBe('Plan Nutricional Personalizado');
    expect(summary.summary).toBeNull();
    expect(summary.purchasedAt).toBe('2026-01-01T00:00:00.000Z');
    expect(summary.thumbnailUrl).toBeNull();
    expect(fileStorage.getSignedDownloadUrl).toHaveBeenCalledTimes(1);
  });

  it('un plan estándar toma nombre y resumen del producto (null si el producto no tiene resumen cargado)', async () => {
    const predefined = {
      id: 'order-2',
      creationDate,
      paymentDate,
      pdfKey: 'productos-estandarizados/plan-running.pdf',
      thumbnailKey: null,
      product: {
        type: 'PREDEFINED',
        name: 'Plan Running',
        goal: null,
        dietRegimen: null,
        calorieIntake: null,
        proteinIntake: null,
        carbohydrateIntake: null,
        lipidIntake: null,
      },
      plan: null,
    };
    orderRepository.getPaidOrdersWithPdfByUserId.mockResolvedValue([
      predefined,
      { ...predefined, id: 'order-3', product: { ...predefined.product, dietRegimen: 'Normocalórico', calorieIntake: 2500 } },
    ]);

    const [withoutSummary, withSummary] = await useCase.execute({ claims });

    expect(withoutSummary).toMatchObject({ type: 'PREDEFINED', name: 'Plan Running', summary: null });
    expect(withSummary.summary).toEqual({
      goal: null,
      dietRegimen: 'Normocalórico',
      calorieIntake: 2500,
      proteinIntake: null,
      carbohydrateIntake: null,
      lipidIntake: null,
    });
  });
});
