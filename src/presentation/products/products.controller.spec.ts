import { Test, TestingModule } from '@nestjs/testing';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';

describe('ProductsController', () => {
  let controller: ProductsController;
  let service: jest.Mocked<ProductsService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProductsController],
      providers: [{ provide: ProductsService, useValue: { getPredefinedProduct: jest.fn() } }],
    }).compile();

    controller = module.get(ProductsController);
    service = module.get(ProductsService);
  });

  it('getPredefinedProduct() delega en ProductsService con el code recibido', async () => {
    const dto = {
      code: 'plan-gimnasio-volumen-50-60-m-joven',
      name: 'Plan Volumen',
      description: 'd',
      price: 14990,
      currency: 'CLP',
      thumbnailUrl: null,
    };
    service.getPredefinedProduct.mockResolvedValue(dto);

    await expect(controller.getPredefinedProduct('plan-gimnasio-volumen-50-60-m-joven')).resolves.toEqual(dto);
    expect(service.getPredefinedProduct).toHaveBeenCalledWith('plan-gimnasio-volumen-50-60-m-joven');
  });
});
