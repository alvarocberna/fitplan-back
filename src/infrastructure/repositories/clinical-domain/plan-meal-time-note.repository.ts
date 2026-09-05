import { Injectable } from '@nestjs/common';
import { PlanMealTimeNoteRepository } from '../../../domain/repositories/clinical-domain/plan-meal-time-note.repository';
import { PlanMealTimeNoteDatasource } from '../../../domain/datasources/clinical-domain/plan-meal-time-note.datasource';
import { PlanMealTimeNoteEntity } from '../../../domain/entities/nutritional-plan.entity';
import {
  CreatePlanMealTimeNoteDto,
  UpdatePlanMealTimeNoteDto,
} from '../../../domain';

@Injectable()
export class PlanMealTimeNoteRepositoryImpl
  implements PlanMealTimeNoteRepository
{
  constructor(private readonly datasource: PlanMealTimeNoteDatasource) {}

  createPlanMealTimeNote(
    createPlanMealTimeNoteDto: CreatePlanMealTimeNoteDto,
  ): Promise<PlanMealTimeNoteEntity> {
    return this.datasource.createPlanMealTimeNote(createPlanMealTimeNoteDto);
  }

  getPlanMealTimeNoteById(id: string): Promise<PlanMealTimeNoteEntity | null> {
    return this.datasource.getPlanMealTimeNoteById(id);
  }

  updatePlanMealTimeNoteById(
    id: string,
    updatePlanMealTimeNoteDto: UpdatePlanMealTimeNoteDto,
  ): Promise<PlanMealTimeNoteEntity> {
    return this.datasource.updatePlanMealTimeNoteById(
      id,
      updatePlanMealTimeNoteDto,
    );
  }

  deletePlanMealTimeNoteById(id: string): Promise<void> {
    return this.datasource.deletePlanMealTimeNoteById(id);
  }
}
