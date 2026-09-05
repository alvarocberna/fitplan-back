import { PlanMealTimeNoteEntity } from '../../../entities/nutritional-plan.entity';

export type CreatePlanMealTimeNoteDto = Omit<
  PlanMealTimeNoteEntity,
  'id' | 'planMealTime'
>;
