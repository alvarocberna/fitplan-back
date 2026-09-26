// Mapea ClinicalRecord / NutritionalConsultation de prisma/schema.prisma (sección CLINICAL DOMAIN).

import type { UserEntity } from './user.entity';
import type { AnamnesisEntity } from './anamnesis.entity';
import type { MeasurementsEntity } from './measurements.entity';
import type { PlanEntity } from './plan.entity';
import type { OrderEntity } from './order.entity';

export interface ClinicalRecordEntity {
  id: string;

  patientId: string;
  patient?: UserEntity;

  createdAt: Date;
  updatedAt: Date | null;

  nutritionalConsultations?: NutritionalConsultationEntity[];
  measurements?: MeasurementsEntity[];
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

  // Vínculo con la orden comercial que originó esta consulta (flujo consulta -> pago -> generación
  // de plan). La orden también queda vinculada al Plan resultante (Plan.orderId).
  orderId: string | null;
  order?: OrderEntity | null;

  createdAt: Date;
  updatedAt: Date | null;

  anamneses?: AnamnesisEntity[];
  measurements?: MeasurementsEntity[];
  plans?: PlanEntity[];
}
