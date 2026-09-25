import { Injectable } from '@nestjs/common';
import { PlanRepository } from '../../../domain/repositories/clinical-domain/plan.repository';
import { PlanDatasource } from '../../../domain/datasources/clinical-domain/plan.datasource';
import { PlanEntity } from '../../../domain/entities/plan.entity';
import {
  CreatePlanDto,
  UpdatePlanDto,
  UpsertPlanWithMainNutritionalPlanDto,
} from '../../../domain';

@Injectable()
export class PlanRepositoryImpl implements PlanRepository {
  constructor(private readonly datasource: PlanDatasource) {}

  createPlan(createPlanDto: CreatePlanDto): Promise<PlanEntity> {
    return this.datasource.createPlan(createPlanDto);
  }

  upsertPlanWithMainNutritionalPlanByOrderId(
    dto: UpsertPlanWithMainNutritionalPlanDto,
  ): Promise<PlanEntity> {
    return this.datasource.upsertPlanWithMainNutritionalPlanByOrderId(dto);
  }

  getPlanById(id: string): Promise<PlanEntity | null> {
    return this.datasource.getPlanById(id);
  }

  updatePlanById(
    id: string,
    updatePlanDto: UpdatePlanDto,
  ): Promise<PlanEntity> {
    return this.datasource.updatePlanById(id, updatePlanDto);
  }

  deletePlanById(id: string): Promise<void> {
    return this.datasource.deletePlanById(id);
  }
}
