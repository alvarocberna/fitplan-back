import { NotFoundException } from '@nestjs/common';
import { PurchaseStandardPlanUseCase } from './purchase-standard-plan.use-case';
import { CurrentUserResolver } from '../../identity/current-user.resolver';
import { CreateOrderUseCase } from '../../billing/use-cases/create-order.use-case';
import { ProductRepository } from '../../../domain/repositories/commercial-domain/product.repository';
import type { CognitoUserClaims } from '../../../common/auth/cognito-user.decorator';

describe('PurchaseStandardPlanUseCase', () => {
  let useCase: PurchaseStandardPlanUseCase;
  let currentUser: { resolve: jest.Mock; isProfileComplete: jest.Mock };
  let productRepository: { getActivePredefinedProductByCode: jest.Mock };
  let createOrder: { execute: jest.Mock };

  const claims: CognitoUserClaims = { sub: 'test-sub' };
  const code = 'plan-gimnasio-volumen-50-60-m-joven';
  const product = {
    id: 'product-2',
    code,
    price: 14990,
    currency: 'CLP',
    pdfKey: 'productos-estandarizados/plan-gimnasio-volumen-50-60-m-joven.pdf',
  };

  beforeEach(() => {
    currentUser = {
      resolve: jest.fn().mockResolvedValue({ id: 'user-1' }),
      isProfileComplete: jest.fn(),
    };
    productRepository = { getActivePredefinedProductByCode: jest.fn() };
    createOrder = { execute: jest.fn().mockResolvedValue({ id: 'order-2' }) };
    useCase = new PurchaseStandardPlanUseCase(
      currentUser as unknown as CurrentUserResolver,
      productRepository as unknown as ProductRepository,
      createOrder as unknown as CreateOrderUseCase,
    );
  });

  it('crea la orden (vía billing) con el producto de la versión, sin exigir perfil completo', async () => {
    productRepository.getActivePredefinedProductByCode.mockResolvedValue(product);

    await expect(useCase.execute({ claims, code })).resolves.toEqual({ orderId: 'order-2' });

    expect(currentUser.resolve).toHaveBeenCalledWith(claims);
    expect(productRepository.getActivePredefinedProductByCode).toHaveBeenCalledWith(code);
    expect(createOrder.execute).toHaveBeenCalledWith({ userId: 'user-1', product });
    expect(currentUser.isProfileComplete).not.toHaveBeenCalled();
  });

  it('lanza NotFoundException si la versión no existe o está inactiva', async () => {
    productRepository.getActivePredefinedProductByCode.mockResolvedValue(null);

    await expect(useCase.execute({ claims, code })).rejects.toBeInstanceOf(NotFoundException);
    expect(createOrder.execute).not.toHaveBeenCalled();
  });

  it('lanza NotFoundException si el producto está activo pero aún no tiene PDF (no se puede vender)', async () => {
    productRepository.getActivePredefinedProductByCode.mockResolvedValue({
      ...product,
      pdfKey: null,
    });

    await expect(useCase.execute({ claims, code })).rejects.toBeInstanceOf(NotFoundException);
    expect(createOrder.execute).not.toHaveBeenCalled();
  });

  it('lanza NotFoundException con un código de formato inválido, sin consultar la base de datos', async () => {
    await expect(useCase.execute({ claims, code: '../../etc/passwd' })).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(productRepository.getActivePredefinedProductByCode).not.toHaveBeenCalled();
  });
});
