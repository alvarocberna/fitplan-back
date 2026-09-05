import { NutritionalPlanEntity } from '../../../entities/nutritional-plan.entity';

export type CreateNutritionalPlanDto = Omit<
  NutritionalPlanEntity,
  | 'id'
  | 'consultation'
  | 'order'
  | 'mealTimes'
  | 'supplement'
  | 'sportsRecommendations'
>;
