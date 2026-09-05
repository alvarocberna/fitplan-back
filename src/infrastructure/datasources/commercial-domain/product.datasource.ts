import { Injectable } from '@nestjs/common';
import { Product as PrismaProduct } from '../../../../generated/prisma';
import { PrismaService } from '../../orm/prisma/prisma.service';
import { ProductDatasource } from '../../../domain/datasources/commercial-domain/product.datasource';
import {
  ProductEntity,
  ProductType,
} from '../../../domain/entities/product.entity';
import { CreateProductDto, UpdateProductDto } from '../../../domain';

@Injectable()
export class ProductDatasourceImpl implements ProductDatasource {
  constructor(private readonly prisma: PrismaService) {}

  // `price` es Decimal(12,2) en Postgres (Prisma lo devuelve como instancia Decimal, no number);
  // `type` se guarda como String (sin enum nativo en el schema) y ya llega validado vía CreateProductDto.
  private toEntity(product: PrismaProduct): ProductEntity {
    return {
      ...product,
      price: product.price.toNumber(),
      type: product.type as ProductType,
    };
  }

  async createProduct(
    createProductDto: CreateProductDto,
  ): Promise<ProductEntity> {
    const product = await this.prisma.product.create({
      data: createProductDto,
    });
    return this.toEntity(product);
  }

  async getProductById(id: string): Promise<ProductEntity | null> {
    const product = await this.prisma.product.findUnique({ where: { id } });
    return product ? this.toEntity(product) : null;
  }

  async updateProductById(
    id: string,
    updateProductDto: UpdateProductDto,
  ): Promise<ProductEntity> {
    const product = await this.prisma.product.update({
      where: { id },
      data: updateProductDto,
    });
    return this.toEntity(product);
  }

  async deleteProductById(id: string): Promise<void> {
    await this.prisma.product.delete({ where: { id } });
  }
}
