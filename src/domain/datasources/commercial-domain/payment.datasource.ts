import { PaymentEntity } from '../../entities/payment.entity';
import { ClosePaymentDto, CreatePaymentDto, UpdatePaymentDto } from '../..';

export abstract class PaymentDatasource {
  abstract createPayment(
    createPaymentDto: CreatePaymentDto,
  ): Promise<PaymentEntity>;
  abstract getPaymentById(id: string): Promise<PaymentEntity | null>;
  abstract updatePaymentById(
    id: string,
    updatePaymentDto: UpdatePaymentDto,
  ): Promise<PaymentEntity>;
  abstract deletePaymentById(id: string): Promise<void>;

  // Intento de pago por el token que le asignó la pasarela.
  abstract getPaymentByToken(token: string): Promise<PaymentEntity | null>;
  // Intento de pago más reciente con esa orden de compra (buy_order).
  abstract getPaymentByIdentifier(
    paymentIdentifier: string,
  ): Promise<PaymentEntity | null>;
  // Cierra un intento que seguía INITIATED con su resultado, sin tocar la orden. Idempotente:
  // devuelve true solo si esta llamada fue la que lo cerró.
  abstract closeInitiatedPayment(
    id: string,
    result: ClosePaymentDto,
  ): Promise<boolean>;
}
