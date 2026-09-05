import { ProductEntity } from '../../../entities/product.entity';

export type CreateProductDto = Omit<
  ProductEntity,
  'id' | 'createdAt' | 'updatedAt' | 'orders'
>;
