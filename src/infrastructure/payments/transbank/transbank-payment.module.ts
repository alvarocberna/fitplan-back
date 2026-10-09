import { Module } from '@nestjs/common';
import { PaymentGateway } from '../../../domain/ports';
import { TransbankPaymentGateway } from './transbank-payment-gateway';

@Module({
  providers: [{ provide: PaymentGateway, useClass: TransbankPaymentGateway }],
  exports: [PaymentGateway],
})
export class TransbankPaymentModule {}
