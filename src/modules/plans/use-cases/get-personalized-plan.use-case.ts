import { Injectable, NotFoundException } from '@nestjs/common';
import { PersonalizedProductDto } from '../../../domain';
import { ProductRepository } from '../../../domain/repositories/commercial-domain/product.repository';

// CU-PLN-09. Ficha pública del plan personalizado (el producto GENERATED activo): el visitante ve el
// precio de la consulta antes de registrarse y de crear la orden. Es el mismo producto del que
// CreateConsultationUseCase toma el monto de la orden, así que el precio mostrado y el cobrado
// coinciden.
@Injectable()
export class GetPersonalizedPlanUseCase {
  constructor(private readonly productRepository: ProductRepository) {}

  async execute(): Promise<PersonalizedProductDto> {
    const product = await this.productRepository.getActiveGeneratedProduct();
    if (!product) {
      throw new NotFoundException('Plan personalizado no disponible');
    }

    return {
      name: product.name,
      description: product.description,
      price: product.price,
      currency: product.currency,
    };
  }
}
