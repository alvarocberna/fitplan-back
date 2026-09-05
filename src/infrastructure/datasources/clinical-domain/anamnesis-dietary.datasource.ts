import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../orm/prisma/prisma.service';
import { AnamnesisDietaryDatasource } from '../../../domain/datasources/clinical-domain/anamnesis-dietary.datasource';
import { AnamnesisDietaryEntity } from '../../../domain/entities/anamnesis.entity';
import {
  CreateAnamnesisDietaryDto,
  UpdateAnamnesisDietaryDto,
} from '../../../domain';

@Injectable()
export class AnamnesisDietaryDatasourceImpl
  implements AnamnesisDietaryDatasource
{
  constructor(private readonly prisma: PrismaService) {}

  async createAnamnesisDietary(
    createAnamnesisDietaryDto: CreateAnamnesisDietaryDto,
  ): Promise<AnamnesisDietaryEntity> {
    return this.prisma.anamnesisDietary.create({
      data: createAnamnesisDietaryDto,
    });
  }

  async getAnamnesisDietaryById(
    id: string,
  ): Promise<AnamnesisDietaryEntity | null> {
    return this.prisma.anamnesisDietary.findUnique({ where: { id } });
  }

  async updateAnamnesisDietaryById(
    id: string,
    updateAnamnesisDietaryDto: UpdateAnamnesisDietaryDto,
  ): Promise<AnamnesisDietaryEntity> {
    return this.prisma.anamnesisDietary.update({
      where: { id },
      data: updateAnamnesisDietaryDto,
    });
  }

  async deleteAnamnesisDietaryById(id: string): Promise<void> {
    await this.prisma.anamnesisDietary.delete({ where: { id } });
  }
}
