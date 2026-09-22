import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ProductsService } from './products.service';
import { ProductRepository } from '../../domain/repositories/commercial-domain/product.repository';
import { StorageService } from '../storage/storage.service';

describe('ProductsService', () => {
  let service: ProductsService;
  let productRepository: jest.Mocked<ProductRepository>;
  let storageService: jest.Mocked<StorageService>;

  const code = 'plan-gimnasio-volumen-50-60-m-joven';
  const product = {
    id: 'product-2',
    type: 'PREDEFINED',
    code,
    name: 'Plan Volumen 50-60 kg',
    description: 'Plan de volumen',
    price: 14990,
    currency: 'CLP',
    pdfKey: 'productos-estandarizados/plan-gimnasio-volumen-50-60-m-joven.pdf',
    thumbnailKey: 'productos-estandarizados/miniaturas/plan-gimnasio-volumen-50-60-m-joven.webp',
    active: true,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsService,
        {
          provide: ProductRepository,
          useValue: { getActivePredefinedProductByCode: jest.fn() },
        },
        { provide: StorageService, useValue: { getSignedDownloadUrl: jest.fn() } },
      ],
    }).compile();

    service = module.get(ProductsService);
    productRepository = module.get(ProductRepository);
    storageService = module.get(StorageService);
  });

  it('devuelve la ficha pública con la URL firmada de la miniatura, sin exponer pdfKey ni thumbnailKey', async () => {
    productRepository.getActivePredefinedProductByCode.mockResolvedValue(product as any);
    storageService.getSignedDownloadUrl.mockResolvedValue('https://signed.example/thumb');

    const result = await service.getPredefinedProduct(code);

    expect(result).toEqual({
      code,
      name: 'Plan Volumen 50-60 kg',
      description: 'Plan de volumen',
      price: 14990,
      currency: 'CLP',
      thumbnailUrl: 'https://signed.example/thumb',
    });
    expect(storageService.getSignedDownloadUrl).toHaveBeenCalledWith(product.thumbnailKey);
    expect(result).not.toHaveProperty('pdfKey');
    expect(result).not.toHaveProperty('thumbnailKey');
  });

  it('thumbnailUrl es null (y no se firma nada) si la versión no tiene miniatura', async () => {
    productRepository.getActivePredefinedProductByCode.mockResolvedValue({
      ...product,
      thumbnailKey: null,
    } as any);

    const result = await service.getPredefinedProduct(code);

    expect(result.thumbnailUrl).toBeNull();
    expect(storageService.getSignedDownloadUrl).not.toHaveBeenCalled();
  });

  it('lanza NotFoundException si la versión no existe o está inactiva', async () => {
    productRepository.getActivePredefinedProductByCode.mockResolvedValue(null);

    await expect(service.getPredefinedProduct(code)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('lanza NotFoundException con un código de formato inválido, sin consultar la base de datos', async () => {
    await expect(service.getPredefinedProduct('../../etc/passwd')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(productRepository.getActivePredefinedProductByCode).not.toHaveBeenCalled();
  });
});
