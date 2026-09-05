import { PlanSportsRecommendationEntity } from '../../../entities/nutritional-plan.entity';

export type CreatePlanSportsRecommendationDto = Omit<
  PlanSportsRecommendationEntity,
  'id' | 'plan'
>;
