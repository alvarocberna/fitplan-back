import { Injectable } from '@nestjs/common';
import { PaymentRepository } from '../../../../domain/repositories/commercial-domain/payment.repository';
import { PaymentDatasource } from '../../../../domain/datasources/commercial-domain/payment.datasource';
import { PaymentEntity } from '../../../../domain/entities/payment.entity';
import {
  ClosePaymentDto,
  CreatePaymentDto,
  UpdatePaymentDto,
} from '../../../../domain';

@Injectable()
export class PaymentRepositoryImpl implements PaymentRepository {
  constructor(private readonly datasource: PaymentDatasource) {}

  createPayment(createPaymentDto: CreatePaymentDto): Promise<PaymentEntity> {
    return this.datasource.createPayment(createPaymentDto);
  }

  getPaymentById(id: string): Promise<PaymentEntity | null> {
    return this.datasource.getPaymentById(id);
  }

  updatePaymentById(
    id: string,
    updatePaymentDto: UpdatePaymentDto,
  ): Promise<PaymentEntity> {
    return this.datasource.updatePaymentById(id, updatePaymentDto);
  }

  deletePaymentById(id: string): Promise<void> {
    return this.datasource.deletePaymentById(id);
  }

  getPaymentByToken(token: string): Promise<PaymentEntity | null> {
    return this.datasource.getPaymentByToken(token);
  }

  getPaymentByIdentifier(
    paymentIdentifier: string,
  ): Promise<PaymentEntity | null> {
    return this.datasource.getPaymentByIdentifier(paymentIdentifier);
  }

  closeInitiatedPayment(id: string, result: ClosePaymentDto): Promise<boolean> {
    return this.datasource.closeInitiatedPayment(id, result);
  }
}
