import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '../../infrastructure/orm/prisma/prisma.service';
import { CompleteConsultationDto, GenerationStatus, OrderStatusDto, NutritionPlanDto } from '../../domain';
import { Order } from '../../../generated/prisma';
import { CompleteConsultationDtoImpl } from '../consultation/dto/consultation.dto';

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(private readonly prisma: PrismaService) {}

  //crea la orden en paymentStatus='pendiente', antes de que el usuario pague
  //(el webhook de pago es server-a-server y no tiene acceso al localStorage del navegador)
  async createOrder(dto: CompleteConsultationDtoImpl): Promise<{ orderId: string }> {
    const email = dto.personalInfo?.email;
    if (!email) {
      throw new BadRequestException('Falta el correo de contacto para la orden');
    }

    const order = await this.prisma.order.create({
      data: {
        id: uuidv4(),
        email,
        payloadJson: JSON.stringify(dto),
      },
    });

    return { orderId: order.id };
  }

  //estado público que consulta el frontend (sin payloadJson, que es información interna)
  async getStatus(id: string): Promise<OrderStatusDto> {
    const order = await this.findById(id);
    return {
      paymentStatus: order.paymentStatus as OrderStatusDto['paymentStatus'],
      generationStatus: order.generationStatus as GenerationStatus,
      planJson: order.planJson ? (JSON.parse(order.planJson) as NutritionPlanDto) : null,
    };
  }

  async findById(id: string): Promise<Order> {
    const order = await this.prisma.order.findUnique({ where: { id } });
    if (!order) throw new NotFoundException(`Orden ${id} no encontrada`);
    return order;
  }

  getPayload(order: Order): CompleteConsultationDto {
    return JSON.parse(order.payloadJson!) as CompleteConsultationDto;
  }

  //idempotente: si ya estaba pagada, no vuelve a marcarla ni dispara nada.
  //devuelve true si esta llamada fue la que efectivamente marcó el pago.
  async markAsPaid(id: string): Promise<boolean> {
    const { count } = await this.prisma.order.updateMany({
      where: { id, paymentStatus: 'pendiente' },
      data: { paymentStatus: 'pagado' },
    });
    return count > 0;
  }

  //guard de estado: solo entra a 'generando' si no estaba ya en ese estado,
  //para evitar que dos disparos concurrentes (ej. reintento manual de webhook) generen el plan dos veces.
  async tryStartGeneration(id: string): Promise<boolean> {
    const { count } = await this.prisma.order.updateMany({
      where: { id, generationStatus: { in: ['no_iniciado', 'error'] } },
      data: { generationStatus: 'generando' },
    });
    return count > 0;
  }

  async completeGeneration(id: string, plan: NutritionPlanDto): Promise<void> {
    await this.prisma.order.update({
      where: { id },
      data: { generationStatus: 'completado', planJson: JSON.stringify(plan) },
    });
  }

  async recordFailedAttempt(id: string): Promise<void> {
    await this.prisma.order.update({
      where: { id },
      data: { generationStatus: 'error', attempts: { increment: 1 } },
    });
  }

  //job de retención: anula el contenido sensible de órdenes antiguas, conservando el resto de la fila
  async cleanupOldOrders(retentionDays: number): Promise<number> {
    const limit = new Date();
    limit.setDate(limit.getDate() - retentionDays);

    const { count } = await this.prisma.order.updateMany({
      where: { createdAt: { lt: limit }, OR: [{ payloadJson: { not: null } }, { planJson: { not: null } }] },
      data: { payloadJson: null, planJson: null },
    });

    if (count > 0) this.logger.log(`Limpieza de retención: ${count} orden(es) anonimizadas`);
    return count;
  }
}
