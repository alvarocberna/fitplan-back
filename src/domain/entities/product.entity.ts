// Mapea Product de prisma/schema.prisma (sección COMMERCIAL DOMAIN).
// `price` es Decimal(12,2) en el schema; se tipa como number en el dominio (la precisión
// decimal exacta se maneja en la capa de infraestructura/ORM).

import type { OrderEntity } from './order.entity';

export type ProductType = 'PREDEFINED' | 'GENERATED';

export interface ProductEntity {
  id: string;

  type: ProductType;
  name: string;
  description: string;

  price: number;
  currency: string;

  // Identificador de la versión de un plan predefinido (p. ej. 'plan-gimnasio-volumen-50-60-m-joven'); es
  // también el nombre de sus archivos en S3. Null para productos GENERATED.
  code: string | null;

  // Object keys en S3 (productos-estandarizados/) del PDF estático y de su miniatura; solo aplican
  // si type = 'PREDEFINED'. Se copian a Order.pdfKey / Order.thumbnailKey al confirmarse el pago.
  pdfKey: string | null;
  thumbnailKey: string | null;

  // Resumen nutricional básico, espejo en inglés de NutritionalPlan (goal, dietRegimen, *Intake).
  // Null hasta que se pueble a mano; permite mostrar algo cuando un plan predefinido —que no genera
  // NutritionalPlan— se muestre en el perfil del usuario.
  goal: string | null;
  dietRegimen: string | null;
  calorieIntake: number | null;
  proteinIntake: number | null;
  carbohydrateIntake: number | null;
  lipidIntake: number | null;

  active: boolean;

  createdAt: Date;
  updatedAt: Date;

  orders?: OrderEntity[];
}
