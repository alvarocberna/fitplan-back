import { PlanMealTimeNoteEntity } from '../../entities/nutritional-plan.entity';
import { CreatePlanMealTimeNoteDto, UpdatePlanMealTimeNoteDto } from '../..';

export abstract class PlanMealTimeNoteDatasource {
  abstract createPlanMealTimeNote(
    createPlanMealTimeNoteDto: CreatePlanMealTimeNoteDto,
  ): Promise<PlanMealTimeNoteEntity>;
  abstract getPlanMealTimeNoteById(
    id: string,
  ): Promise<PlanMealTimeNoteEntity | null>;
  abstract updatePlanMealTimeNoteById(
    id: string,
    updatePlanMealTimeNoteDto: UpdatePlanMealTimeNoteDto,
  ): Promise<PlanMealTimeNoteEntity>;
  abstract deletePlanMealTimeNoteById(id: string): Promise<void>;
}
