import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { GetStandardPlanUseCase } from './get-standard-plan.use-case';
import { ProductRepository } from '../../../domain/repositories/commercial-domain/product.repository';
import { FileStorage } from '../../../domain/ports';

describe('GetStandardPlanUseCase', () => {
  let service: GetStandardPlanUseCase;
  let productRepository: jest.Mocked<ProductRepository>;
  let fileStorage: jest.Mocked<FileStorage>;

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
    thumbnailKey:
      'productos-estandarizados/miniaturas/plan-gimnasio-volumen-50-60-m-joven.webp',
    active: true,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GetStandardPlanUseCase,
        {
          provide: ProductRepository,
          useValue: {
            getActivePredefinedProductByCode: jest.fn(),
            getActivePlanPreviews: jest.fn(),
          },
        },
        { provide: FileStorage, useValue: { getSignedDownloadUrl: jest.fn() } },
      ],
    }).compile();

    service = module.get(GetStandardPlanUseCase);
    productRepository = module.get(ProductRepository);
    fileStorage = module.get(FileStorage);
  });

  it('devuelve la ficha pública con la URL firmada de la miniatura, sin exponer pdfKey ni thumbnailKey', async () => {
    productRepository.getActivePredefinedProductByCode.mockResolvedValue(
      product as any,
    );
    fileStorage.getSignedDownloadUrl.mockResolvedValue(
      'https://signed.example/thumb',
    );

    const result = await service.execute({ code });

    expect(result).toEqual({
      code,
      name: 'Plan Volumen 50-60 kg',
      description: 'Plan de volumen',
      price: 14990,
      currency: 'CLP',
      thumbnailUrl: 'https://signed.example/thumb',
    });
    expect(fileStorage.getSignedDownloadUrl).toHaveBeenCalledWith(
      product.thumbnailKey,
    );
    expect(result).not.toHaveProperty('pdfKey');
    expect(result).not.toHaveProperty('thumbnailKey');
  });

  it('thumbnailUrl es null (y no se firma nada) si la versión no tiene miniatura', async () => {
    productRepository.getActivePredefinedProductByCode.mockResolvedValue({
      ...product,
      thumbnailKey: null,
    } as any);

    const result = await service.execute({ code });

    expect(result.thumbnailUrl).toBeNull();
    expect(fileStorage.getSignedDownloadUrl).not.toHaveBeenCalled();
  });

  it('lanza NotFoundException si la versión no existe o está inactiva', async () => {
    productRepository.getActivePredefinedProductByCode.mockResolvedValue(null);

    await expect(service.execute({ code })).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('lanza NotFoundException con un código de formato inválido, sin consultar la base de datos', async () => {
    await expect(
      service.execute({ code: '../../etc/passwd' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(
      productRepository.getActivePredefinedProductByCode,
    ).not.toHaveBeenCalled();
  });
});
