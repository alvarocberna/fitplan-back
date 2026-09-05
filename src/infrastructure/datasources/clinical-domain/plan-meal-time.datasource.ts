import { Injectable } from '@nestjs/common';
import { PlanMealTime as PrismaPlanMealTime } from '../../../../generated/prisma';
import { PrismaService } from '../../orm/prisma/prisma.service';
import { PlanMealTimeDatasource } from '../../../domain/datasources/clinical-domain/plan-meal-time.datasource';
import {
  PlanMealTimeEntity,
  PlanMealTimeSlot,
} from '../../../domain/entities/nutritional-plan.entity';
import { CreatePlanMealTimeDto, UpdatePlanMealTimeDto } from '../../../domain';

@Injectable()
export class PlanMealTimeDatasourceImpl implements PlanMealTimeDatasource {
  constructor(private readonly prisma: PrismaService) {}

  // `time` se guarda como String en Postgres (sin enum nativo en el schema); se castea acá
  // porque las escrituras siempre pasan por CreatePlanMealTimeDto, que ya lo tipa como PlanMealTimeSlot.
  private toEntity(planMealTime: PrismaPlanMealTime): PlanMealTimeEntity {
    return {
      ...planMealTime,
      time: planMealTime.time as PlanMealTimeSlot | null,
    };
  }

  async createPlanMealTime(
    createPlanMealTimeDto: CreatePlanMealTimeDto,
  ): Promise<PlanMealTimeEntity> {
    const planMealTime = await this.prisma.planMealTime.create({
      data: createPlanMealTimeDto,
    });
    return this.toEntity(planMealTime);
  }

  async getPlanMealTimeById(id: string): Promise<PlanMealTimeEntity | null> {
    const planMealTime = await this.prisma.planMealTime.findUnique({
      where: { id },
    });
    return planMealTime ? this.toEntity(planMealTime) : null;
  }

  async updatePlanMealTimeById(
    id: string,
    updatePlanMealTimeDto: UpdatePlanMealTimeDto,
  ): Promise<PlanMealTimeEntity> {
    const planMealTime = await this.prisma.planMealTime.update({
      where: { id },
      data: updatePlanMealTimeDto,
    });
    return this.toEntity(planMealTime);
  }

  async deletePlanMealTimeById(id: string): Promise<void> {
    await this.prisma.planMealTime.delete({ where: { id } });
  }
}
