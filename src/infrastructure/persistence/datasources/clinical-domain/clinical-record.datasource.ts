import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../orm/prisma/prisma.service';
import { ClinicalRecordDatasource } from '../../../../domain/datasources/clinical-domain/clinical-record.datasource';
import { ClinicalRecordEntity } from '../../../../domain/entities/clinical-record.entity';
import {
  CreateClinicalRecordDto,
  UpdateClinicalRecordDto,
} from '../../../../domain';

@Injectable()
export class ClinicalRecordDatasourceImpl implements ClinicalRecordDatasource {
  constructor(private readonly prisma: PrismaService) {}

  async createClinicalRecord(
    createClinicalRecordDto: CreateClinicalRecordDto,
  ): Promise<ClinicalRecordEntity> {
    return this.prisma.clinicalRecord.create({ data: createClinicalRecordDto });
  }

  async getClinicalRecordById(
    id: string,
  ): Promise<ClinicalRecordEntity | null> {
    return this.prisma.clinicalRecord.findUnique({ where: { id } });
  }

  async updateClinicalRecordById(
    id: string,
    updateClinicalRecordDto: UpdateClinicalRecordDto,
  ): Promise<ClinicalRecordEntity> {
    return this.prisma.clinicalRecord.update({
      where: { id },
      data: updateClinicalRecordDto,
    });
  }

  async deleteClinicalRecordById(id: string): Promise<void> {
    await this.prisma.clinicalRecord.delete({ where: { id } });
  }

  async findOrCreateClinicalRecordByPatientId(
    patientId: string,
  ): Promise<ClinicalRecordEntity> {
    const existing = await this.prisma.clinicalRecord.findUnique({
      where: { patientId },
    });
    if (existing) return existing;
    return this.prisma.clinicalRecord.create({ data: { patientId } });
  }
}
