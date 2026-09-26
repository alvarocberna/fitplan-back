import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../orm/prisma/prisma.service';
import { PlanMealTimeNoteDatasource } from '../../../domain/datasources/clinical-domain/plan-meal-time-note.datasource';
import { PlanMealTimeNoteEntity } from '../../../domain/entities/nutritional-plan.entity';
import {
  CreatePlanMealTimeNoteDto,
  UpdatePlanMealTimeNoteDto,
} from '../../../domain';

@Injectable()
export class PlanMealTimeNoteDatasourceImpl
  implements PlanMealTimeNoteDatasource
{
  constructor(private readonly prisma: PrismaService) {}

  async createPlanMealTimeNote(
    createPlanMealTimeNoteDto: CreatePlanMealTimeNoteDto,
  ): Promise<PlanMealTimeNoteEntity> {
    return this.prisma.planMealTimeNote.create({
      data: createPlanMealTimeNoteDto,
    });
  }

  async getPlanMealTimeNoteById(
    id: string,
  ): Promise<PlanMealTimeNoteEntity | null> {
    return this.prisma.planMealTimeNote.findUnique({
      where: { id },
    });
  }

  async updatePlanMealTimeNoteById(
    id: string,
    updatePlanMealTimeNoteDto: UpdatePlanMealTimeNoteDto,
  ): Promise<PlanMealTimeNoteEntity> {
    return this.prisma.planMealTimeNote.update({
      where: { id },
      data: updatePlanMealTimeNoteDto,
    });
  }

  async deletePlanMealTimeNoteById(id: string): Promise<void> {
    await this.prisma.planMealTimeNote.delete({ where: { id } });
  }
}
