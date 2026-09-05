import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../orm/prisma/prisma.service';
import { NutritionalConsultationDatasource } from '../../../domain/datasources/clinical-domain/nutritional-consultation.datasource';
import { NutritionalConsultationEntity } from '../../../domain/entities/clinical-record.entity';
import {
  CreateNutritionalConsultationDto,
  UpdateNutritionalConsultationDto,
} from '../../../domain';

@Injectable()
export class NutritionalConsultationDatasourceImpl
  implements NutritionalConsultationDatasource
{
  constructor(private readonly prisma: PrismaService) {}

  async createNutritionalConsultation(
    createNutritionalConsultationDto: CreateNutritionalConsultationDto,
  ): Promise<NutritionalConsultationEntity> {
    return this.prisma.nutritionalConsultation.create({
      data: createNutritionalConsultationDto,
    });
  }

  async getNutritionalConsultationById(
    id: string,
  ): Promise<NutritionalConsultationEntity | null> {
    return this.prisma.nutritionalConsultation.findUnique({
      where: { id },
    });
  }

  async updateNutritionalConsultationById(
    id: string,
    updateNutritionalConsultationDto: UpdateNutritionalConsultationDto,
  ): Promise<NutritionalConsultationEntity> {
    return this.prisma.nutritionalConsultation.update({
      where: { id },
      data: updateNutritionalConsultationDto,
    });
  }

  async deleteNutritionalConsultationById(id: string): Promise<void> {
    await this.prisma.nutritionalConsultation.delete({
      where: { id },
    });
  }
}
