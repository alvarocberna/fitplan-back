import { PlanSupplementEntity } from '../../../entities/nutritional-plan.entity';

export type CreatePlanSupplementDto = Omit<
  PlanSupplementEntity,
  'id' | 'plan' | 'notes'
>;
