import { Injectable } from '@nestjs/common';
import { PlanSupplementRepository } from '../../../../domain/repositories/clinical-domain/plan-supplement.repository';
import { PlanSupplementDatasource } from '../../../../domain/datasources/clinical-domain/plan-supplement.datasource';
import { PlanSupplementEntity } from '../../../../domain/entities/nutritional-plan.entity';
import {
  CreatePlanSupplementDto,
  UpdatePlanSupplementDto,
} from '../../../../domain';

@Injectable()
export class PlanSupplementRepositoryImpl implements PlanSupplementRepository {
  constructor(private readonly datasource: PlanSupplementDatasource) {}

  createPlanSupplement(
    createPlanSupplementDto: CreatePlanSupplementDto,
  ): Promise<PlanSupplementEntity> {
    return this.datasource.createPlanSupplement(createPlanSupplementDto);
  }

  getPlanSupplementById(id: string): Promise<PlanSupplementEntity | null> {
    return this.datasource.getPlanSupplementById(id);
  }

  updatePlanSupplementById(
    id: string,
    updatePlanSupplementDto: UpdatePlanSupplementDto,
  ): Promise<PlanSupplementEntity> {
    return this.datasource.updatePlanSupplementById(
      id,
      updatePlanSupplementDto,
    );
  }

  deletePlanSupplementById(id: string): Promise<void> {
    return this.datasource.deletePlanSupplementById(id);
  }
}
