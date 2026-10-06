import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../orm/prisma/prisma.service';
import { isUniqueConstraintError } from '../../orm/prisma/prisma-errors';
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
    // upsert para que dos llamadas simultáneas no choquen con el @unique de patient_id; si aun así
    // pierde la carrera (P2002), la ficha ya existe: se relee.
    try {
      return await this.prisma.clinicalRecord.upsert({
        where: { patientId },
        update: {},
        create: { patientId },
      });
    } catch (error) {
      if (!isUniqueConstraintError(error)) throw error;
      return this.prisma.clinicalRecord.findUniqueOrThrow({ where: { patientId } });
    }
  }
}
