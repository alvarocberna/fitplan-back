import { NotFoundException } from '@nestjs/common';
import { GetPersonalizedPlanUseCase } from './get-personalized-plan.use-case';
import { ProductRepository } from '../../../domain/repositories/commercial-domain/product.repository';

describe('GetPersonalizedPlanUseCase', () => {
  let useCase: GetPersonalizedPlanUseCase;
  let productRepository: { getActiveGeneratedProduct: jest.Mock };

  beforeEach(() => {
    productRepository = { getActiveGeneratedProduct: jest.fn() };
    useCase = new GetPersonalizedPlanUseCase(
      productRepository as unknown as ProductRepository,
    );
  });

  it('devuelve nombre, descripción, precio y moneda del producto GENERATED activo, sin campos internos', async () => {
    productRepository.getActiveGeneratedProduct.mockResolvedValue({
      id: 'product-1',
      type: 'GENERATED',
      name: 'Plan Nutricional Personalizado',
      description: 'Plan generado a partir de la consulta.',
      price: 4990,
      currency: 'CLP',
      pdfKey: null,
      active: true,
    });

    await expect(useCase.execute()).resolves.toEqual({
      name: 'Plan Nutricional Personalizado',
      description: 'Plan generado a partir de la consulta.',
      price: 4990,
      currency: 'CLP',
    });
  });

  it('responde 404 si no hay un producto GENERATED activo', async () => {
    productRepository.getActiveGeneratedProduct.mockResolvedValue(null);

    await expect(useCase.execute()).rejects.toBeInstanceOf(NotFoundException);
  });
});
