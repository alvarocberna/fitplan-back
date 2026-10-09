import { Injectable } from '@nestjs/common';
import { Payment as PrismaPayment } from '../../../../../generated/prisma';
import { PrismaService } from '../../orm/prisma/prisma.service';
import { PaymentDatasource } from '../../../../domain/datasources/commercial-domain/payment.datasource';
import { PaymentEntity } from '../../../../domain/entities/payment.entity';
import {
  ClosePaymentDto,
  CreatePaymentDto,
  UpdatePaymentDto,
} from '../../../../domain';
import { PaymentTransactionStatus } from '../../../../domain/entities/enums';

@Injectable()
export class PaymentDatasourceImpl implements PaymentDatasource {
  constructor(private readonly prisma: PrismaService) {}

  // `amount` es Decimal(12,2) en Postgres (Prisma lo devuelve como instancia Decimal, no number).
  private toEntity(payment: PrismaPayment): PaymentEntity {
    return {
      ...payment,
      amount: payment.amount.toNumber(),
    };
  }

  async createPayment(
    createPaymentDto: CreatePaymentDto,
  ): Promise<PaymentEntity> {
    const payment = await this.prisma.payment.create({
      data: createPaymentDto,
    });
    return this.toEntity(payment);
  }

  async getPaymentById(id: string): Promise<PaymentEntity | null> {
    const payment = await this.prisma.payment.findUnique({ where: { id } });
    return payment ? this.toEntity(payment) : null;
  }

  async updatePaymentById(
    id: string,
    updatePaymentDto: UpdatePaymentDto,
  ): Promise<PaymentEntity> {
    const payment = await this.prisma.payment.update({
      where: { id },
      data: updatePaymentDto,
    });
    return this.toEntity(payment);
  }

  async deletePaymentById(id: string): Promise<void> {
    await this.prisma.payment.delete({ where: { id } });
  }

  async getPaymentByToken(token: string): Promise<PaymentEntity | null> {
    const payment = await this.prisma.payment.findUnique({ where: { token } });
    return payment ? this.toEntity(payment) : null;
  }

  async getPaymentByIdentifier(
    paymentIdentifier: string,
  ): Promise<PaymentEntity | null> {
    const payment = await this.prisma.payment.findFirst({
      where: { paymentIdentifier },
      orderBy: { createdAt: 'desc' },
    });
    return payment ? this.toEntity(payment) : null;
  }

  async closeInitiatedPayment(
    id: string,
    result: ClosePaymentDto,
  ): Promise<boolean> {
    const { count } = await this.prisma.payment.updateMany({
      where: { id, status: PaymentTransactionStatus.INITIATED },
      data: result,
    });
    return count > 0;
  }
}
