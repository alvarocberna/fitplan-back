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

  // Archivo estático; solo aplica si type = 'PREDEFINED'.
  pdfUrl: string | null;

  active: boolean;

  createdAt: Date;
  updatedAt: Date;

  orders?: OrderEntity[];
}
