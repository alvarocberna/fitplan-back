// Proyección de composición corporal de un plan y factibilidad del objetivo, según las reglas de
// doc/nutrition-plan/proyeccion.md:
//
// - "definicion": se proyecta pérdida de 2 kg/mes, toda de grasa corporal.
// - "volumen": se proyecta ganancia del 1% del peso inicial por mes, toda de masa muscular.
// - "mantencion" (u otro): no se proyecta cambio de peso.
// - Período estándar (y máximo) de 3 meses, mínimo 1. En "definicion" se acorta mientras el
//   resultado quede bajo IMC 20 o bajo el %GC mínimo por sexo (H 10%, M 20%); si ni 1 mes es
//   saludable, bajar de peso no es factible (months = 0).

import { MeasurementsEntity } from '../../entities/measurements.entity';
import { calculateBmi } from '../formulas/indexes/bmi.service';

export type ProjectionGoal = 'definicion' | 'volumen' | 'mantencion';

export const PROJECTION_MAX_MONTHS = 3;
export const PROJECTION_MIN_MONTHS = 1;
export const FAT_LOSS_KG_PER_MONTH = 2;
export const MUSCLE_GAIN_RATE_PER_MONTH = 0.01;
export const MIN_HEALTHY_BMI = 20;
export const MIN_HEALTHY_BF_PERCENTAGE: Record<'M' | 'F', number> = { M: 10, F: 20 };

export interface ProjectionInput {
  goal: string;
  weight: number;
  height: number;
  // 'M' | 'F' (o 'masculino'/'femenino': se usa la inicial). Solo afecta el límite de %GC.
  gender: string | null;
  // Composición corporal de base, si se conoce (la consulta hoy solo recoge peso y talla).
  bfPercentage?: number | null;
  mmKg?: number | null;
  startDate: Date;
}

export interface ProjectedValues {
  weight: number;
  bmi: number;
  bfKg: number | null;
  bfPercentage: number | null;
  mmKg: number | null;
  mmPercentage: number | null;
}

export interface ProjectionResult {
  // Meses proyectados (0 = bajar de peso no es factible para este paciente).
  months: number;
  // Término del plan: startDate + months (o + el período estándar si no hay proyección).
  endDate: Date;
  // null si el objetivo no implica cambio de peso o no es factible.
  projected: ProjectedValues | null;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function addMonths(date: Date, months: number): Date {
  const result = new Date(date.getTime());
  result.setUTCMonth(result.getUTCMonth() + months);
  return result;
}

function minBfPercentageFor(gender: string | null): number | null {
  const initial = gender?.charAt(0).toUpperCase();
  if (initial === 'M' || initial === 'F') return MIN_HEALTHY_BF_PERCENTAGE[initial];
  return null;
}

// Pérdida de `lossKg` de grasa: devuelve los valores resultantes (sin redondear).
function afterFatLoss(input: ProjectionInput, lossKg: number) {
  const weight = input.weight - lossKg;
  const bfKg = input.bfPercentage != null ? (input.weight * input.bfPercentage) / 100 - lossKg : null;
  return {
    weight,
    bmi: calculateBmi({ weight, height: input.height }),
    bfKg,
    bfPercentage: bfKg != null ? (bfKg / weight) * 100 : null,
    mmKg: input.mmKg ?? null,
  };
}

function toProjectedValues(values: {
  weight: number;
  bmi: number;
  bfKg: number | null;
  bfPercentage: number | null;
  mmKg: number | null;
}): ProjectedValues {
  return {
    weight: round1(values.weight),
    bmi: round1(values.bmi),
    bfKg: values.bfKg != null ? round1(values.bfKg) : null,
    bfPercentage: values.bfPercentage != null ? round1(values.bfPercentage) : null,
    mmKg: values.mmKg != null ? round1(values.mmKg) : null,
    mmPercentage: values.mmKg != null ? round1((values.mmKg / values.weight) * 100) : null,
  };
}

function projectFatLoss(input: ProjectionInput): ProjectionResult {
  const minBf = minBfPercentageFor(input.gender);
  for (let months = PROJECTION_MAX_MONTHS; months >= PROJECTION_MIN_MONTHS; months--) {
    const values = afterFatLoss(input, FAT_LOSS_KG_PER_MONTH * months);
    const healthyBmi = values.bmi >= MIN_HEALTHY_BMI;
    const healthyBf =
      minBf == null || values.bfPercentage == null || values.bfPercentage >= minBf;
    if (healthyBmi && healthyBf) {
      return {
        months,
        endDate: addMonths(input.startDate, months),
        projected: toProjectedValues(values),
      };
    }
  }
  return {
    months: 0,
    endDate: addMonths(input.startDate, PROJECTION_MAX_MONTHS),
    projected: null,
  };
}

function projectMuscleGain(input: ProjectionInput): ProjectionResult {
  const months = PROJECTION_MAX_MONTHS;
  const gainKg = input.weight * MUSCLE_GAIN_RATE_PER_MONTH * months;
  const weight = input.weight + gainKg;
  const bfKg = input.bfPercentage != null ? (input.weight * input.bfPercentage) / 100 : null;
  return {
    months,
    endDate: addMonths(input.startDate, months),
    projected: toProjectedValues({
      weight,
      bmi: calculateBmi({ weight, height: input.height }),
      bfKg,
      bfPercentage: bfKg != null ? (bfKg / weight) * 100 : null,
      mmKg: input.mmKg != null ? input.mmKg + gainKg : null,
    }),
  };
}

export function calculateProjection(input: ProjectionInput): ProjectionResult {
  if (input.goal === 'definicion') return projectFatLoss(input);
  if (input.goal === 'volumen') return projectMuscleGain(input);
  return {
    months: PROJECTION_MAX_MONTHS,
    endDate: addMonths(input.startDate, PROJECTION_MAX_MONTHS),
    projected: null,
  };
}

// Un objetivo es factible salvo que implique bajar de peso y ni siquiera 1 mes de pérdida deje al
// paciente en un estado nutricional saludable (ej. IMC <= 20).
export function evaluateGoalFeasibility(
  input: Omit<ProjectionInput, 'startDate' | 'mmKg'>,
): { feasible: boolean } {
  if (input.goal !== 'definicion') return { feasible: true };
  const { months } = projectFatLoss({ ...input, startDate: new Date() });
  return { feasible: months > 0 };
}

// Composición corporal de base para proyectar: la consulta solo recoge peso y talla, así que %GC y
// masa muscular salen de la medición más reciente del historial (ordenado del más reciente al más
// antiguo) que tenga alguno de los dos.
export function findLatestBodyComposition(measurements: MeasurementsEntity[]): {
  bfPercentage: number | null;
  mmKg: number | null;
} {
  const results = measurements
    .map((measurement) => measurement.measurementResults?.[0])
    .find((result) => result?.bfPercentage != null || result?.mmKg != null);
  return {
    bfPercentage: results?.bfPercentage ?? null,
    mmKg: results?.mmKg ?? null,
  };
}
