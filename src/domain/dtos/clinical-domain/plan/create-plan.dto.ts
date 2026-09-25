import { PlanEntity } from '../../../entities/plan.entity';

export type CreatePlanDto = Omit<
  PlanEntity,
  'id' | 'consultation' | 'order' | 'nutritionalPlans'
>;
