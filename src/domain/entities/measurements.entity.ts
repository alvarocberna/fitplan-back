// Mapea Measurements y sus hijos de prisma/schema.prisma (sección CLINICAL DOMAIN).
// Una medición siempre pertenece al historial clínico (clinicalRecordId); consultationId es null
// cuando la registró el usuario por su cuenta, fuera de una consulta.
// Nota: solo peso/talla (BasicMeasurements) están conectados al flujo de generación de plan
// actual; el resto (skinfolds, circunferencias, diámetros, resultados derivados) existen en el
// schema pero aún no se usan — ver README "Deuda técnica" / doc/technical-debt.md.

import type {
  ClinicalRecordEntity,
  NutritionalConsultationEntity,
} from './clinical-record.entity';
import type { PlanEntity } from './plan.entity';
import type { MeasurementLevel } from './enums';

export { MeasurementLevel } from './enums';

export interface MeasurementsEntity {
  id: string;

  clinicalRecordId: string;
  clinicalRecord?: ClinicalRecordEntity;

  consultationId: string | null;
  consultation?: NutritionalConsultationEntity | null;

  measuredAt: Date;

  measurementNumber: number;
  level: MeasurementLevel | null;
  description: string | null;

  basicMeasurements?: BasicMeasurementsEntity[];
  skinfolds?: SkinfoldsEntity[];
  circumferences?: CircumferencesEntity[];
  diameters?: DiametersEntity[];
  measurementResults?: MeasurementResultsEntity[];
}

export interface BasicMeasurementsEntity {
  id: string;

  measurementsId: string;
  measurements?: MeasurementsEntity;

  weight: number;
  height: number;
  sittingHeight: number | null;
  armSpan: number | null;
}

export interface SkinfoldsEntity {
  id: string;

  measurementsId: string;
  measurements?: MeasurementsEntity;

  triceps: number | null;
  subscapular: number | null;
  biceps: number | null;
  iliacCrest: number | null;
  supraspinal: number | null;
  abdominal: number | null;
  thigh: number | null;
  calf: number | null;
}

export interface CircumferencesEntity {
  id: string;

  measurementsId: string;
  measurements?: MeasurementsEntity;

  relaxedArm: number | null;
  flexedArm: number | null;
  waist: number | null;
  hip: number | null;
  midThigh: number | null;
  calf: number | null;
}

export interface DiametersEntity {
  id: string;

  measurementsId: string;
  measurements?: MeasurementsEntity;

  humerus: number | null;
  bistyloid: number | null;
  femur: number | null;
}

export interface MeasurementResultsEntity {
  id: string;

  measurementsId: string;
  measurements?: MeasurementsEntity;

  bmi: number | null;
  bmiClassification: string | null;

  bfKg: number | null;
  bfPercentage: number | null;
  bfClassification: string | null;
  bfMethod: string | null;

  vfKg: number | null;
  vfPercentage: number | null;
  vfClassification: string | null;
  vfMethod: string | null;

  mmKg: number | null;
  mmPercentage: number | null;
  mmClassification: string | null;
  mmMethod: string | null;

  bmKg: number | null;
  bmPercentage: number | null;
  bmClassification: string | null;
  bmMethod: string | null;

  lbmi: number | null; // lean body mass index
  lbmiClassification: string | null;

  endo: number | null;
  meso: number | null;
  ecto: number | null;

  phaWeight: number | null;
  phaSkinfoldTriceps: number | null;
  phaSkinfoldSubscapular: number | null;
  phaSkinfoldBiceps: number | null;
  phaSkinfoldIliacCrest: number | null;
  phaSkinfoldSupraspinal: number | null;
  phaSkinfoldAbdominal: number | null;
  phaSkinfoldThigh: number | null;
  phaSkinfoldCalf: number | null;
  phaCircumferenceArm: number | null;
  phaCircumferenceArmFlexed: number | null;
  phaCircumferenceWaist: number | null;
  phaCircumferenceHip: number | null;
  phaCircumferenceThigh: number | null;
  phaCircumferenceCalf: number | null;
  phaDiameterHumerus: number | null;
  phaDiameterBistyloid: number | null;
  phaDiameterFemur: number | null;
}

// Proyección de composición corporal asociada a un Plan (un Plan puede tener varias; aún no se puebla).
export interface ProjectionEntity {
  id: string;

  planId: string;
  plan?: PlanEntity;

  projectedStartDate: Date;
  projectedEndDate: Date;
  projectedWeight: number;
  projectedBfKg: number | null;
  projectedBfPercentage: number | null;
  projectedMmKg: number | null;
  projectedMmPercentage: number | null;
  projectedBmi: number | null;
}
