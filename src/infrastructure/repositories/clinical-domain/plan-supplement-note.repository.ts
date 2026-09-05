import { Injectable } from '@nestjs/common';
import { PlanSupplementNoteRepository } from '../../../domain/repositories/clinical-domain/plan-supplement-note.repository';
import { PlanSupplementNoteDatasource } from '../../../domain/datasources/clinical-domain/plan-supplement-note.datasource';
import { PlanSupplementNoteEntity } from '../../../domain/entities/nutritional-plan.entity';
import {
  CreatePlanSupplementNoteDto,
  UpdatePlanSupplementNoteDto,
} from '../../../domain';

@Injectable()
export class PlanSupplementNoteRepositoryImpl
  implements PlanSupplementNoteRepository
{
  constructor(private readonly datasource: PlanSupplementNoteDatasource) {}

  createPlanSupplementNote(
    createPlanSupplementNoteDto: CreatePlanSupplementNoteDto,
  ): Promise<PlanSupplementNoteEntity> {
    return this.datasource.createPlanSupplementNote(
      createPlanSupplementNoteDto,
    );
  }

  getPlanSupplementNoteById(
    id: string,
  ): Promise<PlanSupplementNoteEntity | null> {
    return this.datasource.getPlanSupplementNoteById(id);
  }

  updatePlanSupplementNoteById(
    id: string,
    updatePlanSupplementNoteDto: UpdatePlanSupplementNoteDto,
  ): Promise<PlanSupplementNoteEntity> {
    return this.datasource.updatePlanSupplementNoteById(
      id,
      updatePlanSupplementNoteDto,
    );
  }

  deletePlanSupplementNoteById(id: string): Promise<void> {
    return this.datasource.deletePlanSupplementNoteById(id);
  }
}
