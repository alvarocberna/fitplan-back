import { Injectable, NotFoundException } from '@nestjs/common';
import {
  isPredefinedPlanCode,
  PredefinedProductDto,
} from '../../domain';
import { ProductRepository } from '../../domain/repositories/commercial-domain/product.repository';
import { StorageService } from '../storage/storage.service';

@Injectable()
export class ProductsService {
  constructor(
    private readonly productRepository: ProductRepository,
    private readonly storageService: StorageService,
  ) {}

  //ficha pública de una versión de plan predefinido. Responde 404 tanto si el código tiene un formato
  //inválido, como si la versión no existe o está inactiva (p. ej. su PDF todavía no se sube): al
  //frontend le da igual cuál de los casos es, y así no se distingue "no existe" de "no disponible".
  async getPredefinedProduct(code: string): Promise<PredefinedProductDto> {
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
        ? await this.storageService.getSignedDownloadUrl(product.thumbnailKey)
        : null,
    };
  }
}
