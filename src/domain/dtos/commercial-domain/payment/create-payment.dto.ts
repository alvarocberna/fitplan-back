import { PaymentEntity } from '../../../entities/payment.entity';

export type CreatePaymentDto = Omit<PaymentEntity, 'id' | 'order'>;
