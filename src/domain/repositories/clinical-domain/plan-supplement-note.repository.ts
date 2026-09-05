import { PlanSupplementNoteEntity } from '../../entities/nutritional-plan.entity';
import {
  CreatePlanSupplementNoteDto,
  UpdatePlanSupplementNoteDto,
} from '../..';

export abstract class PlanSupplementNoteRepository {
  abstract createPlanSupplementNote(
    createPlanSupplementNoteDto: CreatePlanSupplementNoteDto,
  ): Promise<PlanSupplementNoteEntity>;
  abstract getPlanSupplementNoteById(
    id: string,
  ): Promise<PlanSupplementNoteEntity | null>;
  abstract updatePlanSupplementNoteById(
    id: string,
    updatePlanSupplementNoteDto: UpdatePlanSupplementNoteDto,
  ): Promise<PlanSupplementNoteEntity>;
  abstract deletePlanSupplementNoteById(id: string): Promise<void>;
}
