import { Injectable } from '@nestjs/common';
import { Product as PrismaProduct } from '../../../../generated/prisma';
import { PrismaService } from '../../orm/prisma/prisma.service';
import { ProductDatasource } from '../../../domain/datasources/commercial-domain/product.datasource';
import {
  ProductEntity,
  ProductType,
} from '../../../domain/entities/product.entity';
import { CreateProductDto, UpdateProductDto } from '../../../domain';

// Placeholder: no hay pricing real ni negociación comercial en el flujo actual (el pago se
// simula/confirma vía webhook sin gateway real). Ajustar estos valores con negocio antes de
// producción.
const DEFAULT_GENERATED_PRODUCT: CreateProductDto = {
  type: 'GENERATED',
  name: 'Plan Nutricional Personalizado',
  description:
    'Plan nutricional generado automáticamente a partir de la consulta del paciente.',
  price: 19990,
  currency: 'CLP',
  code: null,
  pdfKey: null,
  thumbnailKey: null,
  active: true,
};

@Injectable()
export class ProductDatasourceImpl implements ProductDatasource {
  constructor(private readonly prisma: PrismaService) {}

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

  async getActivePredefinedProductByCode(
    code: string,
  ): Promise<ProductEntity | null> {
    const product = await this.prisma.product.findFirst({
      where: { code, type: 'PREDEFINED', active: true },
    });
    return product ? this.toEntity(product) : null;
  }

  async findOrCreateActiveGeneratedProduct(): Promise<ProductEntity> {
    const existing = await this.prisma.product.findFirst({
      where: { type: 'GENERATED', active: true },
    });
    if (existing) return this.toEntity(existing);
    const created = await this.prisma.product.create({
      data: DEFAULT_GENERATED_PRODUCT,
    });
    return this.toEntity(created);
  }
}
