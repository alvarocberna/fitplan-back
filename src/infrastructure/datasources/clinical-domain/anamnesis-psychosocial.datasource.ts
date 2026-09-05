import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../orm/prisma/prisma.service';
import { AnamnesisPsychosocialDatasource } from '../../../domain/datasources/clinical-domain/anamnesis-psychosocial.datasource';
import { AnamnesisPsychosocialEntity } from '../../../domain/entities/anamnesis.entity';
import {
  CreateAnamnesisPsychosocialDto,
  UpdateAnamnesisPsychosocialDto,
} from '../../../domain';

@Injectable()
export class AnamnesisPsychosocialDatasourceImpl
  implements AnamnesisPsychosocialDatasource
{
  constructor(private readonly prisma: PrismaService) {}

  async createAnamnesisPsychosocial(
    createAnamnesisPsychosocialDto: CreateAnamnesisPsychosocialDto,
  ): Promise<AnamnesisPsychosocialEntity> {
    return this.prisma.anamnesisPsychosocial.create({
      data: createAnamnesisPsychosocialDto,
    });
  }

  async getAnamnesisPsychosocialById(
    id: string,
  ): Promise<AnamnesisPsychosocialEntity | null> {
    return this.prisma.anamnesisPsychosocial.findUnique({ where: { id } });
  }

  async updateAnamnesisPsychosocialById(
    id: string,
    updateAnamnesisPsychosocialDto: UpdateAnamnesisPsychosocialDto,
  ): Promise<AnamnesisPsychosocialEntity> {
    return this.prisma.anamnesisPsychosocial.update({
      where: { id },
      data: updateAnamnesisPsychosocialDto,
    });
  }

  async deleteAnamnesisPsychosocialById(id: string): Promise<void> {
    await this.prisma.anamnesisPsychosocial.delete({ where: { id } });
  }
}
