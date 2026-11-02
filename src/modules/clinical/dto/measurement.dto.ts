import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsNumber,
  IsOptional,
  IsPositive,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import type { MeasurementLevel } from '../../../domain/entities/enums';
import type { MeasurementValueUnit } from '../../../domain/dtos/clinical-domain/measurements/measurement-details.dto';

// ---------------------------------------------------------------------------------------------
// Entrada
// ---------------------------------------------------------------------------------------------

export type { MeasurementValueUnit };
export const MEASUREMENT_VALUE_UNITS: readonly MeasurementValueUnit[] = [
  'PERCENTAGE',
  'KG',
];

// Tipos que el usuario puede registrar por su cuenta (ISAK 1 requiere un antropometrista).
export const RECORDABLE_LEVELS = ['BASIC', 'BIOIMPEDANCE'] as const;
export type RecordableLevel = (typeof RECORDABLE_LEVELS)[number];

// Componente de una bioimpedancia (grasa corporal, masa muscular, grasa visceral o masa ósea), en %
// o en kg (lo que muestre la balanza), nunca ambos: el otro lo calcula el backend.
export class MeasurementValueDtoImpl {
  @IsNumber()
  @IsPositive()
  value!: number;

  @IsIn(MEASUREMENT_VALUE_UNITS)
  unit!: MeasurementValueUnit;
}

// Body de POST /me/measurements (CU-CLI-05). Las reglas que cruzan campos (fecha no futura,
// componentes según el tipo, % y kg coherentes con el peso) viven en measurement-input.ts. En una
// bioimpedancia bodyFat y muscleMass son obligatorios; visceralFat y boneMass, opcionales.
export class RecordMeasurementDtoImpl {
  @IsIn(RECORDABLE_LEVELS)
  level!: RecordableLevel;

  @IsDateString()
  @IsOptional()
  measuredAt?: string;

  @IsNumber()
  @Min(20)
  @Max(300)
  weight!: number;

  @IsNumber()
  @Min(100)
  @Max(250)
  height!: number;

  @ValidateNested()
  @Type(() => MeasurementValueDtoImpl)
  @IsOptional()
  bodyFat?: MeasurementValueDtoImpl;

  @ValidateNested()
  @Type(() => MeasurementValueDtoImpl)
  @IsOptional()
  muscleMass?: MeasurementValueDtoImpl;

  @ValidateNested()
  @Type(() => MeasurementValueDtoImpl)
  @IsOptional()
  visceralFat?: MeasurementValueDtoImpl;

  @ValidateNested()
  @Type(() => MeasurementValueDtoImpl)
  @IsOptional()
  boneMass?: MeasurementValueDtoImpl;
}

// Body de PATCH /me/measurements/:id (CU-CLI-06): solo lo que cambia. Sin `level`: cambiar de tipo
// es registrar otra medición. Los resultados (IMC, kg y %) se recalculan con el estado final.
export class UpdateMeasurementDtoImpl {
  @IsDateString()
  @IsOptional()
  measuredAt?: string;

  @IsNumber()
  @Min(20)
  @Max(300)
  @IsOptional()
  weight?: number;

  @IsNumber()
  @Min(100)
  @Max(250)
  @IsOptional()
  height?: number;

  @ValidateNested()
  @Type(() => MeasurementValueDtoImpl)
  @IsOptional()
  bodyFat?: MeasurementValueDtoImpl;

  @ValidateNested()
  @Type(() => MeasurementValueDtoImpl)
  @IsOptional()
  muscleMass?: MeasurementValueDtoImpl;

  // Opcionales: ausente mantiene lo guardado; null lo quita.
  @ValidateNested()
  @Type(() => MeasurementValueDtoImpl)
  @IsOptional()
  visceralFat?: MeasurementValueDtoImpl | null;

  @ValidateNested()
  @Type(() => MeasurementValueDtoImpl)
  @IsOptional()
  boneMass?: MeasurementValueDtoImpl | null;
}

// Query de GET /me/measurements (CU-CLI-03): rango opcional de measured_at.
export class ListMeasurementsQueryImpl {
  @IsDateString()
  @IsOptional()
  from?: string;

  @IsDateString()
  @IsOptional()
  to?: string;
}

// ---------------------------------------------------------------------------------------------
// Salida
// ---------------------------------------------------------------------------------------------

// No es columna: se deriva de consultation_id (nulo = registrada por el usuario).
export type MeasurementOrigin = 'CONSULTATION' | 'SELF_REPORTED';

// Ítem de GET /me/measurements. bmi/bmiClassification/bf*/mm* salen de
// measurement_results tal como están guardados (null si no se ingresaron o calcularon).
export interface MeasurementSummaryDto {
  measurementId: string;
  measurementNumber: number;
  measuredAt: string; // ISO
  level: MeasurementLevel | null;
  origin: MeasurementOrigin;
  consultationId: string | null;
  consultationNumber: number | null;
  weight: number | null;
  height: number | null;
  bmi: number | null;
  bmiClassification: string | null;
  bfKg: number | null;
  bfPercentage: number | null;
  mmKg: number | null;
  mmPercentage: number | null;
}

// Una sección de valores crudos (basic_measurements, skinfolds, ...): solo los campos con valor.
export type MeasurementRawSection = Record<string, number>;

export interface MeasurementResultDto {
  // BMI, BODY_FAT_PERCENTAGE, BODY_FAT_KG, VISCERAL_FAT_*, MUSCLE_MASS_*, BONE_MASS_*, LBMI,
  // ENDOMORPHY, MESOMORPHY, ECTOMORPHY.
  indicator: string;
  value: number;
  unit: string | null;
  classification: string | null;
  method: string | null;
}

// Respuesta de GET/POST/PATCH /me/measurements[/:id]. Los rangos de referencia por indicador
// (para el gráfico de interpretación) quedan para cuando existan las fórmulas.
export interface MeasurementDetailDto
  extends Omit<
    MeasurementSummaryDto,
    | 'weight'
    | 'height'
    | 'bmi'
    | 'bmiClassification'
    | 'bfKg'
    | 'bfPercentage'
    | 'mmKg'
    | 'mmPercentage'
  > {
  // Hoy toda medición es editable (también las de consulta).
  editable: boolean;
  raw: {
    basic: MeasurementRawSection | null;
    skinfolds: MeasurementRawSection | null;
    circumferences: MeasurementRawSection | null;
    diameters: MeasurementRawSection | null;
  };
  results: MeasurementResultDto[];
}
