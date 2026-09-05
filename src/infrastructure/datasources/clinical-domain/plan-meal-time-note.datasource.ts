import { Injectable } from '@nestjs/common';
import { PlanMealTimeNote as PrismaPlanMealTimeNote } from '../../../../generated/prisma';
import { PrismaService } from '../../orm/prisma/prisma.service';
import { PlanMealTimeNoteDatasource } from '../../../domain/datasources/clinical-domain/plan-meal-time-note.datasource';
import {
  PlanMealTimeNoteEntity,
  PlanMealTimeNoteType,
} from '../../../domain/entities/nutritional-plan.entity';
import {
  CreatePlanMealTimeNoteDto,
  UpdatePlanMealTimeNoteDto,
} from '../../../domain';

@Injectable()
export class PlanMealTimeNoteDatasourceImpl
  implements PlanMealTimeNoteDatasource
{
  constructor(private readonly prisma: PrismaService) {}

  // `type` se guarda como String en Postgres (sin enum nativo en el schema); se castea acá
  // porque las escrituras siempre pasan por CreatePlanMealTimeNoteDto, que ya lo tipa como PlanMealTimeNoteType.
  private toEntity(
    planMealTimeNote: PrismaPlanMealTimeNote,
  ): PlanMealTimeNoteEntity {
    return {
      ...planMealTimeNote,
      type: planMealTimeNote.type as PlanMealTimeNoteType,
    };
  }

  async createPlanMealTimeNote(
    createPlanMealTimeNoteDto: CreatePlanMealTimeNoteDto,
  ): Promise<PlanMealTimeNoteEntity> {
    const planMealTimeNote = await this.prisma.planMealTimeNote.create({
      data: createPlanMealTimeNoteDto,
    });
    return this.toEntity(planMealTimeNote);
  }

  async getPlanMealTimeNoteById(
    id: string,
  ): Promise<PlanMealTimeNoteEntity | null> {
    const planMealTimeNote = await this.prisma.planMealTimeNote.findUnique({
      where: { id },
    });
    return planMealTimeNote ? this.toEntity(planMealTimeNote) : null;
  }

  async updatePlanMealTimeNoteById(
    id: string,
    updatePlanMealTimeNoteDto: UpdatePlanMealTimeNoteDto,
  ): Promise<PlanMealTimeNoteEntity> {
    const planMealTimeNote = await this.prisma.planMealTimeNote.update({
      where: { id },
      data: updatePlanMealTimeNoteDto,
    });
    return this.toEntity(planMealTimeNote);
  }

  async deletePlanMealTimeNoteById(id: string): Promise<void> {
    await this.prisma.planMealTimeNote.delete({ where: { id } });
  }
}
