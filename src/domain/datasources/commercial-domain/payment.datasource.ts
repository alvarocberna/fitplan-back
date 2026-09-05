import { PaymentEntity } from '../../entities/payment.entity';
import { CreatePaymentDto, UpdatePaymentDto } from '../..';

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
}
