import type { MeasurementLevel } from '../../../entities/enums';
import type {
  BasicMeasurementsEntity,
  MeasurementResultsEntity,
} from '../../../entities/measurements.entity';

// Valores de basic_measurements que se escriben junto con la medición (sin id ni FK: las resuelve
// el nested create de Prisma).
export type MeasurementBasicInput = Pick<
  BasicMeasurementsEntity,
  'weight' | 'height'
> &
  Partial<Pick<BasicMeasurementsEntity, 'sittingHeight' | 'armSpan'>>;

// Columnas de measurement_results que se escriben (hoy solo las que ingresa el usuario en una
// bioimpedancia: grasa y masa muscular, en % o kg, con su método).
export type MeasurementResultsInput = Partial<
  Omit<MeasurementResultsEntity, 'id' | 'measurementsId' | 'measurements'>
>;

// Medición registrada por el usuario (sin consulta: consultation_id = null), con sus hijas, en una
// sola escritura (CU-CLI-05).
export interface CreateMeasurementWithDetailsDto {
  clinicalRecordId: string;
  measuredAt: Date;
  level: MeasurementLevel;
  measurementNumber: number;
  basic: MeasurementBasicInput;
  results: MeasurementResultsInput | null;
}

// Corrección de una medición (CU-CLI-06): solo lo que cambia. `basic`/`results` actualizan la
// primera fila hija (o la crean si no existe).
export interface UpdateMeasurementWithDetailsDto {
  measuredAt?: Date;
  basic?: Partial<MeasurementBasicInput>;
  results?: MeasurementResultsInput;
}

// Filtro opcional por rango de measured_at (CU-CLI-03).
export interface MeasurementsDateRange {
  from?: Date;
  to?: Date;
}
