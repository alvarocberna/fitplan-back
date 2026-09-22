// Mapea Payment de prisma/schema.prisma (sección COMMERCIAL DOMAIN).
// `amount` es Decimal(12,2) en el schema; se tipa como number en el dominio.

import type { OrderEntity } from './order.entity';

// 'SIMULATED' es el pago simulado (POST /webhooks/ordenes/:id/simular-pago) mientras no haya una
// pasarela real integrada: sus campos de detalle (identificador, autorización, tarjeta) son placeholders.
export type PaymentProvider = 'TRANSBANK' | 'SIMULATED';
export type PaymentTransactionStatus = 'AUTHORIZED' | 'REJECTED' | 'CANCELLED';

export interface PaymentEntity {
  id: string;

  orderId: string;
  order?: OrderEntity;

  provider: PaymentProvider;
  paymentIdentifier: string; // identificador Transbank
  authorizationCode: string;
  amount: number;
  installmentCount: number;
  status: PaymentTransactionStatus;
  transactionDate: Date;
  movementType: string;
  cardType: string;
}
