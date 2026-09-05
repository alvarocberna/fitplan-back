import { PlanMealTimeEntity } from '../../../entities/nutritional-plan.entity';

export type CreatePlanMealTimeDto = Omit<
  PlanMealTimeEntity,
  'id' | 'plan' | 'notes'
>;
