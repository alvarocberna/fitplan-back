// Mapea Payment de prisma/schema.prisma (sección COMMERCIAL DOMAIN).
// `amount` es Decimal(12,2) en el schema; se tipa como number en el dominio.

import type { OrderEntity } from './order.entity';

import type { PaymentProvider, PaymentTransactionStatus } from './enums';

export { PaymentProvider, PaymentTransactionStatus } from './enums';

// Una fila por intento de pago. Con Transbank se crea INITIATED al iniciar el pago (solo con
// paymentIdentifier, token y amount) y se completa con el resultado al volver de la pasarela.
// Con provider = SIMULATED los campos de detalle (identificador, autorización, tarjeta) son placeholders.

export interface PaymentEntity {
  id: string;

  orderId: string;
  order?: OrderEntity;

  provider: PaymentProvider;
  paymentIdentifier: string; // orden de compra (buy_order) en Transbank
  token: string | null; // token de la transacción en la pasarela
  authorizationCode: string | null;
  amount: number;
  installmentCount: number | null;
  status: PaymentTransactionStatus;
  responseCode: number | null; // código de respuesta de la pasarela (0 = aprobado)
  transactionDate: Date | null;
  movementType: string | null; // tipo de pago de la pasarela (VD, VN, VP, ...)
  cardType: string | null;
  cardLastDigits: string | null;

  createdAt: Date;
}
