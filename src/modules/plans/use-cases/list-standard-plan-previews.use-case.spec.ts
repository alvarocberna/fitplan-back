import { Test, TestingModule } from '@nestjs/testing';
import { ListStandardPlanPreviewsUseCase } from './list-standard-plan-previews.use-case';
import { ProductRepository } from '../../../domain/repositories/commercial-domain/product.repository';
import { FileStorage } from '../../../domain/ports';

describe('ListStandardPlanPreviewsUseCase', () => {
  let service: ListStandardPlanPreviewsUseCase;
  let productRepository: jest.Mocked<ProductRepository>;
  let fileStorage: jest.Mocked<FileStorage>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ListStandardPlanPreviewsUseCase,
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

    service = module.get(ListStandardPlanPreviewsUseCase);
    productRepository = module.get(ProductRepository);
    fileStorage = module.get(FileStorage);
  });

  const previews = [
    {
      id: 'preview-1',
      type: 'PREDEFINED',
      code: 'plan-gimnasio-volumen',
      name: 'Plan Gimnasio Volumen',
      description: 'Plan nutricional para entrenamiento de gimnasio en periodo de volumen.',
      price: 5990,
      currency: 'CLP',
      pdfKey: null,
      thumbnailKey: 'productos-estandarizados/miniaturas/plan-gimnasio-volumen.webp',
      active: true,
    },
    {
      id: 'preview-2',
      type: 'PREDEFINED',
      code: 'plan-running',
      name: 'Plan Running',
      description: 'Plan nutricional para entrenamiento de running.',
      price: 5990,
      currency: 'CLP',
      pdfKey: null,
      thumbnailKey: null,
      active: true,
    },
  ];

  it('mapea cada fila a su ficha pública, firmando la miniatura y sin exponer pdfKey/thumbnailKey', async () => {
    productRepository.getActivePlanPreviews.mockResolvedValue(previews as any);
    fileStorage.getSignedDownloadUrl.mockResolvedValue('https://signed.example/preview.webp');

    const result = await service.execute();

    expect(result).toEqual([
      {
        code: 'plan-gimnasio-volumen',
        name: 'Plan Gimnasio Volumen',
        description: 'Plan nutricional para entrenamiento de gimnasio en periodo de volumen.',
        thumbnailUrl: 'https://signed.example/preview.webp',
      },
      {
        code: 'plan-running',
        name: 'Plan Running',
        description: 'Plan nutricional para entrenamiento de running.',
        thumbnailUrl: null,
      },
    ]);
    expect(fileStorage.getSignedDownloadUrl).toHaveBeenCalledTimes(1);
    expect(fileStorage.getSignedDownloadUrl).toHaveBeenCalledWith(
      'productos-estandarizados/miniaturas/plan-gimnasio-volumen.webp',
    );
    result.forEach((item) => {
      expect(item).not.toHaveProperty('pdfKey');
      expect(item).not.toHaveProperty('thumbnailKey');
    });
  });

  it('devuelve un arreglo vacío si no hay filas activas', async () => {
    productRepository.getActivePlanPreviews.mockResolvedValue([]);

    await expect(service.execute()).resolves.toEqual([]);
    expect(fileStorage.getSignedDownloadUrl).not.toHaveBeenCalled();
  });
});
