import { Injectable } from '@nestjs/common';
import { Payment as PrismaPayment } from '../../../../generated/prisma';
import { PrismaService } from '../../orm/prisma/prisma.service';
import { PaymentDatasource } from '../../../domain/datasources/commercial-domain/payment.datasource';
import { PaymentEntity } from '../../../domain/entities/payment.entity';
import { CreatePaymentDto, UpdatePaymentDto } from '../../../domain';

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
}
