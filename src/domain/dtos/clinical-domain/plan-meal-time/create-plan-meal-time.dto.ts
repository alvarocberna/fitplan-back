import { PlanMealTimeEntity } from '../../../entities/nutritional-plan.entity';

export type CreatePlanMealTimeDto = Omit<
  PlanMealTimeEntity,
  'id' | 'nutritionalPlan' | 'notes'
>;
