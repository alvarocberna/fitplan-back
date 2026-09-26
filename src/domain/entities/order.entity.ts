// Mapea el modelo `Order` (tabla `order`) de prisma/schema.prisma (sección COMMERCIAL DOMAIN).
// No confundir con OrderDto (domain/dtos/order.dto.ts): ese es el flujo legacy sobre la tabla
// SQLite `orden`; esta es la orden comercial del nuevo schema Postgres (usuario + producto + pago).
// `amount` es Decimal(12,2) en el schema; se tipa como number en el dominio.

import type { UserEntity } from './user.entity';
import type { ProductEntity } from './product.entity';
import type { PaymentEntity } from './payment.entity';
import type { PlanEntity } from './plan.entity';
import type { NutritionalConsultationEntity } from './clinical-record.entity';

import type { PaymentStatus, GenerationStatus } from './enums';

export { PaymentStatus, GenerationStatus } from './enums';

export interface OrderEntity {
  id: string;

  userId: string;
  user?: UserEntity;

  productId: string;
  product?: ProductEntity;

  // Monto efectivamente cobrado (puede diferir de product.price por descuentos/promos).
  amount: number;
  currency: string;
  paymentStatus: PaymentStatus;

  // Estado del pipeline de generación del plan (background, fire-and-forget desde el webhook de
  // pago) y su resultado. No es un dato comercial del pedido en sí, pero vive acá por continuidad
  // con el flujo legacy (antes columnas de la tabla `orden`) y porque el pipeline opera 1:1 sobre
  // una Order.
  generationStatus: GenerationStatus;
  planJson: string | null;
  pdfKey: string | null;
  // Miniatura (página 1 del PDF) en S3; null si aún no se generó o si la rasterización falló
  // (es best-effort: no bloquea la entrega del plan).
  thumbnailKey: string | null;
  attempts: number;

  creationDate: Date;
  paymentDate: Date | null;
  expirationDate: Date | null;

  payments?: PaymentEntity[];
  plan?: PlanEntity | null;
  nutritionalConsultation?: NutritionalConsultationEntity | null;
}
