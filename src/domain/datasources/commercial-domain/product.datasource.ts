import { ProductEntity } from '../../entities/product.entity';
import { CreateProductDto, UpdateProductDto } from '../..';

export abstract class ProductDatasource {
  abstract createProduct(
    createProductDto: CreateProductDto,
  ): Promise<ProductEntity>;
  abstract getProductById(id: string): Promise<ProductEntity | null>;
  abstract updateProductById(
    id: string,
    updateProductDto: UpdateProductDto,
  ): Promise<ProductEntity>;
  abstract deleteProductById(id: string): Promise<void>;
}
