// Mapea ClinicalRecord / NutritionalConsultation de prisma/schema.prisma (sección CLINICAL DOMAIN).

import type { UserEntity } from './user.entity';
import type { AnamnesisEntity } from './anamnesis.entity';
import type { MeasurementsEntity } from './measurements.entity';
import type { NutritionalPlanEntity } from './nutritional-plan.entity';

export interface ClinicalRecordEntity {
  id: string;

  patientId: string;
  patient?: UserEntity;

  createdAt: Date;
  updatedAt: Date;

  nutritionalConsultations?: NutritionalConsultationEntity[];
}

export interface NutritionalConsultationEntity {
  id: string;

  clinicalRecordId: string;
  clinicalRecord?: ClinicalRecordEntity;

  patientId: string;
  patient?: UserEntity;

  consultationNumber: number;
  consultationDate: Date;
  description: string | null;

  createdAt: Date;
  updatedAt: Date;

  anamneses?: AnamnesisEntity[];
  measurements?: MeasurementsEntity[];
  nutritionalPlans?: NutritionalPlanEntity[];
}
