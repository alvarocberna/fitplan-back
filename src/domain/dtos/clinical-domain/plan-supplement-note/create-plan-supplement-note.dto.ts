import { PlanSupplementNoteEntity } from '../../../entities/nutritional-plan.entity';

export type CreatePlanSupplementNoteDto = Omit<
  PlanSupplementNoteEntity,
  'id' | 'planSupplement'
>;
