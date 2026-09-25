import { Controller, Get, Param } from '@nestjs/common';
import { PredefinedProductDto, PredefinedPlanPreviewDto } from '../../domain';
import { ProductsService } from './products.service';

@Controller('productos')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  //las hasta 4 filas "vista previa" (una por familia de plan) para el carrusel del home. Público,
  //segmento propio (no bajo predefinidos/) para no ambigüar con predefinidos/:code.
  @Get('vista-previa')
  getPlanPreviews(): Promise<PredefinedPlanPreviewDto[]> {
    return this.productsService.getPlanPreviews();
  }

  //catálogo de planes predefinidos: público a propósito (sin CognitoAuthGuard), el visitante ve el
  //precio y la vista previa de su versión antes de registrarse. No expone el PDF ni sus keys.
  @Get('predefinidos/:code')
  getPredefinedProduct(
    @Param('code') code: string,
  ): Promise<PredefinedProductDto> {
    return this.productsService.getPredefinedProduct(code);
  }
}
