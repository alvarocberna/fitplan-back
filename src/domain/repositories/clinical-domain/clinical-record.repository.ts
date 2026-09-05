import { ClinicalRecordEntity } from '../../entities/clinical-record.entity';
import { CreateClinicalRecordDto, UpdateClinicalRecordDto } from '../..';

export abstract class ClinicalRecordRepository {
  abstract createClinicalRecord(
    createClinicalRecordDto: CreateClinicalRecordDto,
  ): Promise<ClinicalRecordEntity>;
  abstract getClinicalRecordById(
    id: string,
  ): Promise<ClinicalRecordEntity | null>;
  abstract updateClinicalRecordById(
    id: string,
    updateClinicalRecordDto: UpdateClinicalRecordDto,
  ): Promise<ClinicalRecordEntity>;
  abstract deleteClinicalRecordById(id: string): Promise<void>;
}
