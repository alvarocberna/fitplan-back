import { Injectable } from '@nestjs/common';
import { NutritionalPlanRepository } from '../../../../domain/repositories/clinical-domain/nutritional-plan.repository';
import { NutritionalPlanDatasource } from '../../../../domain/datasources/clinical-domain/nutritional-plan.datasource';
import { NutritionalPlanEntity } from '../../../../domain/entities/nutritional-plan.entity';
import {
  CreateNutritionalPlanDto,
  UpdateNutritionalPlanDto,
} from '../../../../domain';

@Injectable()
export class NutritionalPlanRepositoryImpl
  implements NutritionalPlanRepository
{
  constructor(private readonly datasource: NutritionalPlanDatasource) {}

  createNutritionalPlan(
    createNutritionalPlanDto: CreateNutritionalPlanDto,
  ): Promise<NutritionalPlanEntity> {
    return this.datasource.createNutritionalPlan(createNutritionalPlanDto);
  }

  getNutritionalPlanById(id: string): Promise<NutritionalPlanEntity | null> {
    return this.datasource.getNutritionalPlanById(id);
  }

  updateNutritionalPlanById(
    id: string,
    updateNutritionalPlanDto: UpdateNutritionalPlanDto,
  ): Promise<NutritionalPlanEntity> {
    return this.datasource.updateNutritionalPlanById(
      id,
      updateNutritionalPlanDto,
    );
  }

  deleteNutritionalPlanById(id: string): Promise<void> {
    return this.datasource.deleteNutritionalPlanById(id);
  }
}
