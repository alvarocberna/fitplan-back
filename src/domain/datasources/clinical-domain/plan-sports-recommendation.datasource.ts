import { PlanSportsRecommendationEntity } from '../../entities/nutritional-plan.entity';
import {
  CreatePlanSportsRecommendationDto,
  UpdatePlanSportsRecommendationDto,
} from '../..';

export abstract class PlanSportsRecommendationDatasource {
  abstract createPlanSportsRecommendation(
    createPlanSportsRecommendationDto: CreatePlanSportsRecommendationDto,
  ): Promise<PlanSportsRecommendationEntity>;
  abstract getPlanSportsRecommendationById(
    id: string,
  ): Promise<PlanSportsRecommendationEntity | null>;
  abstract updatePlanSportsRecommendationById(
    id: string,
    updatePlanSportsRecommendationDto: UpdatePlanSportsRecommendationDto,
  ): Promise<PlanSportsRecommendationEntity>;
  abstract deletePlanSportsRecommendationById(id: string): Promise<void>;
}
