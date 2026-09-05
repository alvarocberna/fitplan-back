import { NutritionalConsultationEntity } from '../../../entities/clinical-record.entity';

export type CreateNutritionalConsultationDto = Omit<
  NutritionalConsultationEntity,
  | 'id'
  | 'createdAt'
  | 'updatedAt'
  | 'clinicalRecord'
  | 'patient'
  | 'anamneses'
  | 'measurements'
  | 'nutritionalPlans'
>;
