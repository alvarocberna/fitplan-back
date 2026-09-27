import { Injectable } from '@nestjs/common';
import { PlanMealTimeRepository } from '../../../../domain/repositories/clinical-domain/plan-meal-time.repository';
import { PlanMealTimeDatasource } from '../../../../domain/datasources/clinical-domain/plan-meal-time.datasource';
import { PlanMealTimeEntity } from '../../../../domain/entities/nutritional-plan.entity';
import { CreatePlanMealTimeDto, UpdatePlanMealTimeDto } from '../../../../domain';

@Injectable()
export class PlanMealTimeRepositoryImpl implements PlanMealTimeRepository {
  constructor(private readonly datasource: PlanMealTimeDatasource) {}

  createPlanMealTime(
    createPlanMealTimeDto: CreatePlanMealTimeDto,
  ): Promise<PlanMealTimeEntity> {
    return this.datasource.createPlanMealTime(createPlanMealTimeDto);
  }

  getPlanMealTimeById(id: string): Promise<PlanMealTimeEntity | null> {
    return this.datasource.getPlanMealTimeById(id);
  }

  updatePlanMealTimeById(
    id: string,
    updatePlanMealTimeDto: UpdatePlanMealTimeDto,
  ): Promise<PlanMealTimeEntity> {
    return this.datasource.updatePlanMealTimeById(id, updatePlanMealTimeDto);
  }

  deletePlanMealTimeById(id: string): Promise<void> {
    return this.datasource.deletePlanMealTimeById(id);
  }
}
