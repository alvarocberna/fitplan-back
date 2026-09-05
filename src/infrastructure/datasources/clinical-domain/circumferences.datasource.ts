import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../orm/prisma/prisma.service';
import { CircumferencesDatasource } from '../../../domain/datasources/clinical-domain/circumferences.datasource';
import { CircumferencesEntity } from '../../../domain/entities/measurements.entity';
import {
  CreateCircumferencesDto,
  UpdateCircumferencesDto,
} from '../../../domain';

@Injectable()
export class CircumferencesDatasourceImpl implements CircumferencesDatasource {
  constructor(private readonly prisma: PrismaService) {}

  async createCircumferences(
    createCircumferencesDto: CreateCircumferencesDto,
  ): Promise<CircumferencesEntity> {
    return this.prisma.circumferences.create({ data: createCircumferencesDto });
  }

  async getCircumferencesById(
    id: string,
  ): Promise<CircumferencesEntity | null> {
    return this.prisma.circumferences.findUnique({ where: { id } });
  }

  async updateCircumferencesById(
    id: string,
    updateCircumferencesDto: UpdateCircumferencesDto,
  ): Promise<CircumferencesEntity> {
    return this.prisma.circumferences.update({
      where: { id },
      data: updateCircumferencesDto,
    });
  }

  async deleteCircumferencesById(id: string): Promise<void> {
    await this.prisma.circumferences.delete({ where: { id } });
  }
}
