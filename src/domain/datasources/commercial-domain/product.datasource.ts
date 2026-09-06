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

  // Busca un Product activo de tipo GENERATED; si no existe, crea uno con valores por defecto
  // (ver el *Impl — son placeholders, hay que revisarlos con negocio). Usado por
  // OrdersService.createOrder para resolver el productId de la nueva Order sin ningún seed previo.
  abstract findOrCreateActiveGeneratedProduct(): Promise<ProductEntity>;
}
