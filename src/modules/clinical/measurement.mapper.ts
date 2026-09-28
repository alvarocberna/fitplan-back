// Mapeos de la medición (con sus hijas) a los DTOs de salida de /me/measurements.

import {
  MeasurementResultsEntity,
  MeasurementsEntity,
} from '../../domain/entities/measurements.entity';
import {
  MeasurementDetailDto,
  MeasurementOrigin,
  MeasurementRawSection,
  MeasurementResultDto,
  MeasurementSummaryDto,
} from './dto/measurement.dto';

export function originOf(measurement: MeasurementsEntity): MeasurementOrigin {
  return measurement.consultationId ? 'CONSULTATION' : 'SELF_REPORTED';
}

function baseOf(measurement: MeasurementsEntity) {
  return {
    measurementId: measurement.id,
    measurementNumber: measurement.measurementNumber,
    measuredAt: measurement.measuredAt.toISOString(),
    level: measurement.level,
    origin: originOf(measurement),
    consultationId: measurement.consultationId,
    consultationNumber: measurement.consultation?.consultationNumber ?? null,
  };
}

export function toMeasurementSummary(
  measurement: MeasurementsEntity,
): MeasurementSummaryDto {
  const basic = measurement.basicMeasurements?.[0];
  const results = measurement.measurementResults?.[0];
  return {
    ...baseOf(measurement),
    weight: basic?.weight ?? null,
    height: basic?.height ?? null,
    bmi: results?.bmi ?? null,
    bmiClassification: results?.bmiClassification ?? null,
    bfKg: results?.bfKg ?? null,
    bfPercentage: results?.bfPercentage ?? null,
    mmKg: results?.mmKg ?? null,
    mmPercentage: results?.mmPercentage ?? null,
  };
}

export function toMeasurementDetail(
  measurement: MeasurementsEntity,
): MeasurementDetailDto {
  return {
    ...baseOf(measurement),
    editable: true,
    raw: {
      basic: rawSection(measurement.basicMeasurements?.[0]),
      skinfolds: rawSection(measurement.skinfolds?.[0]),
      circumferences: rawSection(measurement.circumferences?.[0]),
      diameters: rawSection(measurement.diameters?.[0]),
    },
    results: resultsOf(measurement.measurementResults?.[0]),
  };
}

// Solo los valores numéricos presentes de una fila hija (sin id ni FK); null si no hay ninguno.
function rawSection(row: object | undefined): MeasurementRawSection | null {
  if (!row) return null;
  const entries = Object.entries(row).filter(
    ([key, value]) =>
      key !== 'id' && key !== 'measurementsId' && typeof value === 'number',
  ) as [string, number][];
  return entries.length > 0 ? Object.fromEntries(entries) : null;
}

type ResultsRow = Omit<MeasurementResultsEntity, 'id' | 'measurementsId' | 'measurements'>;

// Indicadores interpretados de measurement_results, en el orden en que se muestran. Las columnas
// pha_* (proporcionalidad phantom) se omiten hasta que existan las fórmulas que las calculen.
const RESULT_INDICATORS: {
  indicator: string;
  value: keyof ResultsRow;
  unit: string | null;
  classification?: keyof ResultsRow;
  method?: keyof ResultsRow;
}[] = [
  { indicator: 'BMI', value: 'bmi', unit: 'kg/m²', classification: 'bmiClassification' },
  { indicator: 'BODY_FAT_PERCENTAGE', value: 'bfPercentage', unit: '%', classification: 'bfClassification', method: 'bfMethod' },
  { indicator: 'BODY_FAT_KG', value: 'bfKg', unit: 'kg', classification: 'bfClassification', method: 'bfMethod' },
  { indicator: 'VISCERAL_FAT_PERCENTAGE', value: 'vfPercentage', unit: '%', classification: 'vfClassification', method: 'vfMethod' },
  { indicator: 'VISCERAL_FAT_KG', value: 'vfKg', unit: 'kg', classification: 'vfClassification', method: 'vfMethod' },
  { indicator: 'MUSCLE_MASS_PERCENTAGE', value: 'mmPercentage', unit: '%', classification: 'mmClassification', method: 'mmMethod' },
  { indicator: 'MUSCLE_MASS_KG', value: 'mmKg', unit: 'kg', classification: 'mmClassification', method: 'mmMethod' },
  { indicator: 'BONE_MASS_PERCENTAGE', value: 'bmPercentage', unit: '%', classification: 'bmClassification', method: 'bmMethod' },
  { indicator: 'BONE_MASS_KG', value: 'bmKg', unit: 'kg', classification: 'bmClassification', method: 'bmMethod' },
  { indicator: 'LBMI', value: 'lbmi', unit: 'kg/m²', classification: 'lbmiClassification' },
  { indicator: 'ENDOMORPHY', value: 'endo', unit: null },
  { indicator: 'MESOMORPHY', value: 'meso', unit: null },
  { indicator: 'ECTOMORPHY', value: 'ecto', unit: null },
];

function resultsOf(row: ResultsRow | undefined): MeasurementResultDto[] {
  if (!row) return [];
  return RESULT_INDICATORS.filter(({ value }) => typeof row[value] === 'number').map(
    ({ indicator, value, unit, classification, method }) => ({
      indicator,
      value: row[value] as number,
      unit,
      classification: classification ? ((row[classification] as string | null) ?? null) : null,
      method: method ? ((row[method] as string | null) ?? null) : null,
    }),
  );
}
