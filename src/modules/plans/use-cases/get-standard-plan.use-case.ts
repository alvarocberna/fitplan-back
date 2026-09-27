import { Injectable, NotFoundException } from '@nestjs/common';
import { isPredefinedPlanCode, PredefinedProductDto } from '../../../domain';
import { FileStorage } from '../../../domain/ports';
import { ProductRepository } from '../../../domain/repositories/commercial-domain/product.repository';

// CU-PLN-02. Ficha pública de una versión de plan estándar: el visitante ve el precio y la vista
// previa antes de registrarse. No expone el PDF ni sus keys, solo la URL ya firmada de la miniatura.
@Injectable()
export class GetStandardPlanUseCase {
  constructor(
    private readonly productRepository: ProductRepository,
    private readonly fileStorage: FileStorage,
  ) {}

  // Responde 404 tanto si el código tiene un formato inválido como si la versión no existe o está
  // inactiva (p. ej. su PDF todavía no se sube): al frontend le da igual cuál de los casos es.
  async execute(input: { code: string }): Promise<PredefinedProductDto> {
    const { code } = input;
    const product = isPredefinedPlanCode(code)
      ? await this.productRepository.getActivePredefinedProductByCode(code)
      : null;
    if (!product?.code) {
      throw new NotFoundException(`Plan ${code} no disponible`);
    }

    return {
      code: product.code,
      name: product.name,
      description: product.description,
      price: product.price,
      currency: product.currency,
      thumbnailUrl: product.thumbnailKey
        ? await this.fileStorage.getSignedDownloadUrl(product.thumbnailKey)
        : null,
    };
  }
}
