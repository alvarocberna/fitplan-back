// Mapea ClinicalRecord / NutritionalConsultation de prisma/schema.prisma (sección CLINICAL DOMAIN).

import type { UserEntity } from './user.entity';
import type { AnamnesisEntity } from './anamnesis.entity';
import type { MeasurementsEntity } from './measurements.entity';
import type { NutritionalPlanEntity } from './nutritional-plan.entity';
import type { OrderEntity } from './order.entity';

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

  // Vínculo con la orden comercial que originó esta consulta (flujo consulta -> pago -> generación
  // de plan). Simétrico al patrón ya usado por NutritionalPlan.orderId.
  orderId: string | null;
  order?: OrderEntity | null;

  // Dato puntual de la consulta (no de la identidad del paciente), recolectado en personalInfo.athlete.
  athlete: boolean | null;

  createdAt: Date;
  updatedAt: Date;

  anamneses?: AnamnesisEntity[];
  measurements?: MeasurementsEntity[];
  nutritionalPlans?: NutritionalPlanEntity[];
}
