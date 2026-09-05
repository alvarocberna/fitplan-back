import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../orm/prisma/prisma.service';
import { ClinicalConditionDatasource } from '../../../domain/datasources/clinical-domain/clinical-condition.datasource';
import { ClinicalConditionEntity } from '../../../domain/entities/anamnesis.entity';
import {
  CreateClinicalConditionDto,
  UpdateClinicalConditionDto,
} from '../../../domain';

@Injectable()
export class ClinicalConditionDatasourceImpl
  implements ClinicalConditionDatasource
{
  constructor(private readonly prisma: PrismaService) {}

  async createClinicalCondition(
    createClinicalConditionDto: CreateClinicalConditionDto,
  ): Promise<ClinicalConditionEntity> {
    return this.prisma.clinicalCondition.create({
      data: createClinicalConditionDto,
    });
  }

  async getClinicalConditionById(
    id: string,
  ): Promise<ClinicalConditionEntity | null> {
    return this.prisma.clinicalCondition.findUnique({ where: { id } });
  }

  async updateClinicalConditionById(
    id: string,
    updateClinicalConditionDto: UpdateClinicalConditionDto,
  ): Promise<ClinicalConditionEntity> {
    return this.prisma.clinicalCondition.update({
      where: { id },
      data: updateClinicalConditionDto,
    });
  }

  async deleteClinicalConditionById(id: string): Promise<void> {
    await this.prisma.clinicalCondition.delete({ where: { id } });
  }
}
