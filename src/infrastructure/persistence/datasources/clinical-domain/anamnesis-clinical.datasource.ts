import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../orm/prisma/prisma.service';
import { AnamnesisClinicalDatasource } from '../../../../domain/datasources/clinical-domain/anamnesis-clinical.datasource';
import { AnamnesisClinicalEntity } from '../../../../domain/entities/anamnesis.entity';
import {
  CreateAnamnesisClinicalDto,
  UpdateAnamnesisClinicalDto,
} from '../../../../domain';

@Injectable()
export class AnamnesisClinicalDatasourceImpl
  implements AnamnesisClinicalDatasource
{
  constructor(private readonly prisma: PrismaService) {}

  async createAnamnesisClinical(
    createAnamnesisClinicalDto: CreateAnamnesisClinicalDto,
  ): Promise<AnamnesisClinicalEntity> {
    return this.prisma.anamnesisClinical.create({
      data: createAnamnesisClinicalDto,
    });
  }

  async getAnamnesisClinicalById(
    id: string,
  ): Promise<AnamnesisClinicalEntity | null> {
    return this.prisma.anamnesisClinical.findUnique({ where: { id } });
  }

  async updateAnamnesisClinicalById(
    id: string,
    updateAnamnesisClinicalDto: UpdateAnamnesisClinicalDto,
  ): Promise<AnamnesisClinicalEntity> {
    return this.prisma.anamnesisClinical.update({
      where: { id },
      data: updateAnamnesisClinicalDto,
    });
  }

  async deleteAnamnesisClinicalById(id: string): Promise<void> {
    await this.prisma.anamnesisClinical.delete({ where: { id } });
  }
}
