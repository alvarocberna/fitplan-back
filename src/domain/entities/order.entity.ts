// Mapea el modelo `Order` (tabla `order`) de prisma/schema.prisma (sección COMMERCIAL DOMAIN).
// No confundir con OrderDto (domain/dtos/order.dto.ts): ese es el flujo legacy sobre la tabla
// SQLite `orden`; esta es la orden comercial del nuevo schema Postgres (usuario + producto + pago).
// `amount` es Decimal(12,2) en el schema; se tipa como number en el dominio.

import type { UserEntity } from './user.entity';
import type { ProductEntity } from './product.entity';
import type { PaymentEntity } from './payment.entity';
import type { NutritionalPlanEntity } from './nutritional-plan.entity';

export type OrderStatus = 'PENDING' | 'PAID' | 'EXPIRED' | 'CANCELLED';

export interface OrderEntity {
  id: string;

  userId: string;
  user?: UserEntity;

  productId: string;
  product?: ProductEntity;

  // Monto efectivamente cobrado (puede diferir de product.price por descuentos/promos).
  amount: number;
  currency: string;
  status: OrderStatus;

  creationDate: Date;
  paymentDate: Date | null;
  expirationDate: Date | null;

  payments?: PaymentEntity[];
  nutritionalPlan?: NutritionalPlanEntity | null;
}
