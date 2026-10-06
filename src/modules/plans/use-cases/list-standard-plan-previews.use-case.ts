import { Injectable } from '@nestjs/common';
import { PredefinedPlanPreviewDto } from '../../../domain';
import { FileStorage } from '../../../domain/ports';
import { ProductRepository } from '../../../domain/repositories/commercial-domain/product.repository';

// CU-PLN-01. Vista previa por familia de plan (hasta 4 filas) para el carrusel del home. Público a
// propósito, igual que GetStandardPlanUseCase: no expone pdfKey/thumbnailKey, solo la URL firmada.
@Injectable()
export class ListStandardPlanPreviewsUseCase {
  constructor(
    private readonly productRepository: ProductRepository,
    private readonly fileStorage: FileStorage,
  ) {}

  async execute(): Promise<PredefinedPlanPreviewDto[]> {
    const products = await this.productRepository.getActivePlanPreviews();

    return Promise.all(
      products.map(async (product) => ({
        code: product.code!,
        name: product.name,
        description: product.description,
        thumbnailUrl: product.thumbnailKey
          ? await this.fileStorage.getSignedDownloadUrl(product.thumbnailKey)
          : null,
      })),
    );
  }
}
