import { ClinicalRecordEntity } from '../../../entities/clinical-record.entity';

export type CreateClinicalRecordDto = Omit<
  ClinicalRecordEntity,
  | 'id'
  | 'createdAt'
  | 'updatedAt'
  | 'patient'
  | 'nutritionalConsultations'
  | 'measurements'
>;
