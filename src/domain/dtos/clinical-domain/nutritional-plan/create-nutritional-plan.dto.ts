import { NutritionalPlanEntity } from '../../../entities/nutritional-plan.entity';

export type CreateNutritionalPlanDto = Omit<
  NutritionalPlanEntity,
  'id' | 'plan' | 'mealTimes' | 'supplement' | 'sportsRecommendations'
>;
