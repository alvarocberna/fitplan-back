import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../orm/prisma/prisma.service';
import { PlanSupplementNoteDatasource } from '../../../domain/datasources/clinical-domain/plan-supplement-note.datasource';
import { PlanSupplementNoteEntity } from '../../../domain/entities/nutritional-plan.entity';
import {
  CreatePlanSupplementNoteDto,
  UpdatePlanSupplementNoteDto,
} from '../../../domain';

@Injectable()
export class PlanSupplementNoteDatasourceImpl
  implements PlanSupplementNoteDatasource
{
  constructor(private readonly prisma: PrismaService) {}

  async createPlanSupplementNote(
    createPlanSupplementNoteDto: CreatePlanSupplementNoteDto,
  ): Promise<PlanSupplementNoteEntity> {
    return this.prisma.planSupplementNote.create({
      data: createPlanSupplementNoteDto,
    });
  }

  async getPlanSupplementNoteById(
    id: string,
  ): Promise<PlanSupplementNoteEntity | null> {
    return this.prisma.planSupplementNote.findUnique({
      where: { id },
    });
  }

  async updatePlanSupplementNoteById(
    id: string,
    updatePlanSupplementNoteDto: UpdatePlanSupplementNoteDto,
  ): Promise<PlanSupplementNoteEntity> {
    return this.prisma.planSupplementNote.update({
      where: { id },
      data: updatePlanSupplementNoteDto,
    });
  }

  async deletePlanSupplementNoteById(id: string): Promise<void> {
    await this.prisma.planSupplementNote.delete({ where: { id } });
  }
}
