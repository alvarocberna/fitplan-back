import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../orm/prisma/prisma.service';
import { PlanDatasource } from '../../../../domain/datasources/clinical-domain/plan.datasource';
import { PlanEntity } from '../../../../domain/entities/plan.entity';
import {
  CreatePlanDto,
  UpdatePlanDto,
  UpsertPlanWithMainNutritionalPlanDto,
} from '../../../../domain';

@Injectable()
export class PlanDatasourceImpl implements PlanDatasource {
  constructor(private readonly prisma: PrismaService) {}

  async createPlan(createPlanDto: CreatePlanDto): Promise<PlanEntity> {
    return this.prisma.plan.create({ data: createPlanDto });
  }

  // Una sola escritura anidada (atómica). En el update se borra el NutritionalPlan principal previo
  // y se crea el nuevo; hoy sus tablas hijas (PlanMealTime, PlanSupplement, ...) no se pueblan, así
  // que el deleteMany no choca con FKs. Si algún día se pueblan, habrá que borrarlas antes.
  async upsertPlanWithMainNutritionalPlanByOrderId({
    consultationId,
    orderId,
    nutritionalPlan,
  }: UpsertPlanWithMainNutritionalPlanDto): Promise<PlanEntity> {
    return this.prisma.plan.upsert({
      where: { orderId },
      create: {
        consultationId,
        orderId,
        active: true,
        nutritionalPlans: { create: nutritionalPlan },
      },
      update: {
        nutritionalPlans: {
          deleteMany: { mainPlan: true },
          create: nutritionalPlan,
        },
      },
      include: { nutritionalPlans: true },
    });
  }

  async getPlanById(id: string): Promise<PlanEntity | null> {
    return this.prisma.plan.findUnique({ where: { id } });
  }

  async updatePlanById(
    id: string,
    updatePlanDto: UpdatePlanDto,
  ): Promise<PlanEntity> {
    return this.prisma.plan.update({ where: { id }, data: updatePlanDto });
  }

  async deletePlanById(id: string): Promise<void> {
    await this.prisma.plan.delete({ where: { id } });
  }
}
