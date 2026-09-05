import { Injectable } from '@nestjs/common';
import { PlanSportsRecommendationRepository } from '../../../domain/repositories/clinical-domain/plan-sports-recommendation.repository';
import { PlanSportsRecommendationDatasource } from '../../../domain/datasources/clinical-domain/plan-sports-recommendation.datasource';
import { PlanSportsRecommendationEntity } from '../../../domain/entities/nutritional-plan.entity';
import {
  CreatePlanSportsRecommendationDto,
  UpdatePlanSportsRecommendationDto,
} from '../../../domain';

@Injectable()
export class PlanSportsRecommendationRepositoryImpl
  implements PlanSportsRecommendationRepository
{
  constructor(
    private readonly datasource: PlanSportsRecommendationDatasource,
  ) {}

  createPlanSportsRecommendation(
    createPlanSportsRecommendationDto: CreatePlanSportsRecommendationDto,
  ): Promise<PlanSportsRecommendationEntity> {
    return this.datasource.createPlanSportsRecommendation(
      createPlanSportsRecommendationDto,
    );
  }

  getPlanSportsRecommendationById(
    id: string,
  ): Promise<PlanSportsRecommendationEntity | null> {
    return this.datasource.getPlanSportsRecommendationById(id);
  }

  updatePlanSportsRecommendationById(
    id: string,
    updatePlanSportsRecommendationDto: UpdatePlanSportsRecommendationDto,
  ): Promise<PlanSportsRecommendationEntity> {
    return this.datasource.updatePlanSportsRecommendationById(
      id,
      updatePlanSportsRecommendationDto,
    );
  }

  deletePlanSportsRecommendationById(id: string): Promise<void> {
    return this.datasource.deletePlanSportsRecommendationById(id);
  }
}
