import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../orm/prisma/prisma.service';
import { PlanMealTimeDatasource } from '../../../domain/datasources/clinical-domain/plan-meal-time.datasource';
import { PlanMealTimeEntity } from '../../../domain/entities/nutritional-plan.entity';
import { CreatePlanMealTimeDto, UpdatePlanMealTimeDto } from '../../../domain';

@Injectable()
export class PlanMealTimeDatasourceImpl implements PlanMealTimeDatasource {
  constructor(private readonly prisma: PrismaService) {}

  async createPlanMealTime(
    createPlanMealTimeDto: CreatePlanMealTimeDto,
  ): Promise<PlanMealTimeEntity> {
    return this.prisma.planMealTime.create({
      data: createPlanMealTimeDto,
    });
  }

  async getPlanMealTimeById(id: string): Promise<PlanMealTimeEntity | null> {
    return this.prisma.planMealTime.findUnique({
      where: { id },
    });
  }

  async updatePlanMealTimeById(
    id: string,
    updatePlanMealTimeDto: UpdatePlanMealTimeDto,
  ): Promise<PlanMealTimeEntity> {
    return this.prisma.planMealTime.update({
      where: { id },
      data: updatePlanMealTimeDto,
    });
  }

  async deletePlanMealTimeById(id: string): Promise<void> {
    await this.prisma.planMealTime.delete({ where: { id } });
  }
}
