// Calcula la fila de measurement_results de una medición a partir de lo ingresado (CU-CON-02,
// CU-CLI-05, CU-CLI-06).
//
// - Con peso y talla, siempre: IMC y su clasificación.
// - En una bioimpedancia: grasa corporal, masa muscular, grasa visceral y masa ósea, cada una
//   ingresada en % o en kg; se guarda el valor ingresado y se calcula el otro con el peso. El
//   método queda en BIOIMPEDANCE y las clasificaciones de esos componentes, en null (pendientes).
//   Los componentes no ingresados quedan con sus columnas en null.

import { MeasurementLevel } from '../../entities/enums';
import {
  MeasurementResultsInput,
  MeasurementValueInput,
} from '../../dtos/clinical-domain/measurements/measurement-details.dto';
import { calculateBmi, getBmiClassification } from '../formulas/indexes/bmi.service';
import {
  calculateKgFromPercentage,
  calculatePercentageFromKg,
} from '../formulas/body-composition/mass-conversion.service';

export const BIOIMPEDANCE_METHOD = 'BIOIMPEDANCE';

export interface MeasurementResultsCalculationInput {
  level: MeasurementLevel | null;
  weight?: number | null;
  height?: number | null;
  bodyFat?: MeasurementValueInput;
  muscleMass?: MeasurementValueInput;
  visceralFat?: MeasurementValueInput;
  boneMass?: MeasurementValueInput;
}

// Prefijo de las columnas de cada componente en measurement_results.
type ComponentPrefix = 'bf' | 'mm' | 'vf' | 'bm';

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

// Columnas xxKg / xxPercentage / xxMethod de un componente; en null si no se ingresó (así, al
// recalcular una medición editada, no quedan valores de un componente que se quitó).
function componentResults(
  prefix: ComponentPrefix,
  component: MeasurementValueInput | undefined,
  weight: number,
): MeasurementResultsInput {
  if (!component) {
    return {
      [`${prefix}Kg`]: null,
      [`${prefix}Percentage`]: null,
      [`${prefix}Method`]: null,
    };
  }
  const { value, unit } = component;
  const kg = unit === 'KG' ? value : calculateKgFromPercentage({ weight, percentage: value });
  const percentage =
    unit === 'PERCENTAGE' ? value : calculatePercentageFromKg({ weight, kg: value });
  return {
    [`${prefix}Kg`]: round2(kg),
    [`${prefix}Percentage`]: round2(percentage),
    [`${prefix}Method`]: BIOIMPEDANCE_METHOD,
  };
}

export function calculateMeasurementResults(
  input: MeasurementResultsCalculationInput,
): MeasurementResultsInput {
  const { level, weight, height } = input;
  if (weight == null || height == null) return {};

  const bmi = calculateBmi({ weight, height });
  const results: MeasurementResultsInput = {
    bmi: round2(bmi),
    bmiClassification: getBmiClassification(bmi),
  };
  if (level !== MeasurementLevel.BIOIMPEDANCE) return results;

  return {
    ...results,
    ...componentResults('bf', input.bodyFat, weight),
    ...componentResults('mm', input.muscleMass, weight),
    ...componentResults('vf', input.visceralFat, weight),
    ...componentResults('bm', input.boneMass, weight),
  };
}
