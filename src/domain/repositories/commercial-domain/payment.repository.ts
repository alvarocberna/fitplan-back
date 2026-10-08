import { PaymentEntity } from '../../entities/payment.entity';
import { ClosePaymentDto, CreatePaymentDto, UpdatePaymentDto } from '../..';

export abstract class PaymentRepository {
  abstract createPayment(
    createPaymentDto: CreatePaymentDto,
  ): Promise<PaymentEntity>;
  abstract getPaymentById(id: string): Promise<PaymentEntity | null>;
  abstract updatePaymentById(
    id: string,
    updatePaymentDto: UpdatePaymentDto,
  ): Promise<PaymentEntity>;
  abstract deletePaymentById(id: string): Promise<void>;
  abstract getPaymentByToken(token: string): Promise<PaymentEntity | null>;
  abstract getPaymentByIdentifier(
    paymentIdentifier: string,
  ): Promise<PaymentEntity | null>;
  abstract closeInitiatedPayment(
    id: string,
    result: ClosePaymentDto,
  ): Promise<boolean>;
}
