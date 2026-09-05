import { Injectable } from '@nestjs/common';
import { PlanSupplementNote as PrismaPlanSupplementNote } from '../../../../generated/prisma';
import { PrismaService } from '../../orm/prisma/prisma.service';
import { PlanSupplementNoteDatasource } from '../../../domain/datasources/clinical-domain/plan-supplement-note.datasource';
import {
  PlanSupplementNoteEntity,
  PlanSupplementNoteType,
} from '../../../domain/entities/nutritional-plan.entity';
import {
  CreatePlanSupplementNoteDto,
  UpdatePlanSupplementNoteDto,
} from '../../../domain';

@Injectable()
export class PlanSupplementNoteDatasourceImpl
  implements PlanSupplementNoteDatasource
{
  constructor(private readonly prisma: PrismaService) {}

  // `type` se guarda como String en Postgres (sin enum nativo en el schema); se castea acá
  // porque las escrituras siempre pasan por CreatePlanSupplementNoteDto, que ya lo tipa como PlanSupplementNoteType.
  private toEntity(
    planSupplementNote: PrismaPlanSupplementNote,
  ): PlanSupplementNoteEntity {
    return {
      ...planSupplementNote,
      type: planSupplementNote.type as PlanSupplementNoteType,
    };
  }

  async createPlanSupplementNote(
    createPlanSupplementNoteDto: CreatePlanSupplementNoteDto,
  ): Promise<PlanSupplementNoteEntity> {
    const planSupplementNote = await this.prisma.planSupplementNote.create({
      data: createPlanSupplementNoteDto,
    });
    return this.toEntity(planSupplementNote);
  }

  async getPlanSupplementNoteById(
    id: string,
  ): Promise<PlanSupplementNoteEntity | null> {
    const planSupplementNote = await this.prisma.planSupplementNote.findUnique({
      where: { id },
    });
    return planSupplementNote ? this.toEntity(planSupplementNote) : null;
  }

  async updatePlanSupplementNoteById(
    id: string,
    updatePlanSupplementNoteDto: UpdatePlanSupplementNoteDto,
  ): Promise<PlanSupplementNoteEntity> {
    const planSupplementNote = await this.prisma.planSupplementNote.update({
      where: { id },
      data: updatePlanSupplementNoteDto,
    });
    return this.toEntity(planSupplementNote);
  }

  async deletePlanSupplementNoteById(id: string): Promise<void> {
    await this.prisma.planSupplementNote.delete({ where: { id } });
  }
}
