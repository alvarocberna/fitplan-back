import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../orm/prisma/prisma.service';
import { PlanSupplementDatasource } from '../../../../domain/datasources/clinical-domain/plan-supplement.datasource';
import { PlanSupplementEntity } from '../../../../domain/entities/nutritional-plan.entity';
import {
  CreatePlanSupplementDto,
  UpdatePlanSupplementDto,
} from '../../../../domain';

@Injectable()
export class PlanSupplementDatasourceImpl implements PlanSupplementDatasource {
  constructor(private readonly prisma: PrismaService) {}

  async createPlanSupplement(
    createPlanSupplementDto: CreatePlanSupplementDto,
  ): Promise<PlanSupplementEntity> {
    return this.prisma.planSupplement.create({ data: createPlanSupplementDto });
  }

  async getPlanSupplementById(
    id: string,
  ): Promise<PlanSupplementEntity | null> {
    return this.prisma.planSupplement.findUnique({ where: { id } });
  }

  async updatePlanSupplementById(
    id: string,
    updatePlanSupplementDto: UpdatePlanSupplementDto,
  ): Promise<PlanSupplementEntity> {
    return this.prisma.planSupplement.update({
      where: { id },
      data: updatePlanSupplementDto,
    });
  }

  async deletePlanSupplementById(id: string): Promise<void> {
    await this.prisma.planSupplement.delete({ where: { id } });
  }
}
