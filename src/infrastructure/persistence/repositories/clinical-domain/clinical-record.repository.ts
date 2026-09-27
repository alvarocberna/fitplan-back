import { Injectable } from '@nestjs/common';
import { ClinicalRecordRepository } from '../../../../domain/repositories/clinical-domain/clinical-record.repository';
import { ClinicalRecordDatasource } from '../../../../domain/datasources/clinical-domain/clinical-record.datasource';
import { ClinicalRecordEntity } from '../../../../domain/entities/clinical-record.entity';
import {
  CreateClinicalRecordDto,
  UpdateClinicalRecordDto,
} from '../../../../domain';

@Injectable()
export class ClinicalRecordRepositoryImpl implements ClinicalRecordRepository {
  constructor(private readonly datasource: ClinicalRecordDatasource) {}

  createClinicalRecord(
    createClinicalRecordDto: CreateClinicalRecordDto,
  ): Promise<ClinicalRecordEntity> {
    return this.datasource.createClinicalRecord(createClinicalRecordDto);
  }

  getClinicalRecordById(id: string): Promise<ClinicalRecordEntity | null> {
    return this.datasource.getClinicalRecordById(id);
  }

  updateClinicalRecordById(
    id: string,
    updateClinicalRecordDto: UpdateClinicalRecordDto,
  ): Promise<ClinicalRecordEntity> {
    return this.datasource.updateClinicalRecordById(
      id,
      updateClinicalRecordDto,
    );
  }

  deleteClinicalRecordById(id: string): Promise<void> {
    return this.datasource.deleteClinicalRecordById(id);
  }

  findOrCreateClinicalRecordByPatientId(
    patientId: string,
  ): Promise<ClinicalRecordEntity> {
    return this.datasource.findOrCreateClinicalRecordByPatientId(patientId);
  }
}
