import { Injectable } from '@nestjs/common';
import { ProductRepository } from '../../../../domain/repositories/commercial-domain/product.repository';
import { ProductDatasource } from '../../../../domain/datasources/commercial-domain/product.datasource';
import { ProductEntity } from '../../../../domain/entities/product.entity';
import { CreateProductDto, UpdateProductDto } from '../../../../domain';

@Injectable()
export class ProductRepositoryImpl implements ProductRepository {
  constructor(private readonly datasource: ProductDatasource) {}

  createProduct(createProductDto: CreateProductDto): Promise<ProductEntity> {
    return this.datasource.createProduct(createProductDto);
  }

  getProductById(id: string): Promise<ProductEntity | null> {
    return this.datasource.getProductById(id);
  }

  updateProductById(
    id: string,
    updateProductDto: UpdateProductDto,
  ): Promise<ProductEntity> {
    return this.datasource.updateProductById(id, updateProductDto);
  }

  deleteProductById(id: string): Promise<void> {
    return this.datasource.deleteProductById(id);
  }

  getActivePredefinedProductByCode(code: string): Promise<ProductEntity | null> {
    return this.datasource.getActivePredefinedProductByCode(code);
  }

  getActivePlanPreviews(): Promise<ProductEntity[]> {
    return this.datasource.getActivePlanPreviews();
  }

  findOrCreateActiveGeneratedProduct(): Promise<ProductEntity> {
    return this.datasource.findOrCreateActiveGeneratedProduct();
  }
}
