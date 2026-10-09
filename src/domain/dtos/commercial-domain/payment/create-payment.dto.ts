import { PaymentEntity } from '../../../entities/payment.entity';

// Campos que no existen hasta que la pasarela informa el resultado (o que no aplican al pago simulado).
type OptionalPaymentFields =
  | 'token'
  | 'authorizationCode'
  | 'installmentCount'
  | 'responseCode'
  | 'transactionDate'
  | 'movementType'
  | 'cardType'
  | 'cardLastDigits';

export type CreatePaymentDto = Omit<
  PaymentEntity,
  'id' | 'order' | 'createdAt' | OptionalPaymentFields
> &
  Partial<Pick<PaymentEntity, OptionalPaymentFields>>;

// Resultado de un intento de pago: lo que se escribe en la fila `payment` al cerrarlo.
export type PaymentResultDto = Omit<CreatePaymentDto, 'orderId'>;

// Cierre de un intento INITIATED sin tocar la orden: el estado final y, si los hay, los datos del resultado.
export type ClosePaymentDto = Pick<PaymentResultDto, 'status'> &
  Partial<PaymentResultDto>;
