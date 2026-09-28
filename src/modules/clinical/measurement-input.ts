// Reglas de entrada compartidas por registrar (CU-CLI-05) y corregir (CU-CLI-06) una medición: las
// que cruzan campos y no se pueden expresar con class-validator.

import { BadRequestException } from '@nestjs/common';
import { MeasurementLevel } from '../../domain/entities/enums';
import { MeasurementResultsInput } from '../../domain';
import { MeasurementResultsEntity } from '../../domain/entities/measurements.entity';
import { MeasurementValueUnit } from './dto/measurement.dto';

export interface MeasurementValueInput {
  value: number;
  unit: MeasurementValueUnit;
}

export interface MeasurementInput {
  level: MeasurementLevel | null;
  measuredAt: Date;
  weight: number;
  bodyFat?: MeasurementValueInput;
  muscleMass?: MeasurementValueInput;
}

// Método con el que se guardan grasa y masa muscular ingresadas por el usuario.
export const BIOIMPEDANCE_METHOD = 'BIOIMPEDANCE';

export function assertValidMeasurementInput(input: MeasurementInput): void {
  if (input.measuredAt.getTime() > Date.now()) {
    throw new BadRequestException('La fecha de la medición no puede ser futura');
  }

  const isBioimpedance = input.level === MeasurementLevel.BIOIMPEDANCE;
  if (isBioimpedance && (!input.bodyFat || !input.muscleMass)) {
    throw new BadRequestException(
      'Una medición de bioimpedancia requiere grasa corporal y masa muscular',
    );
  }
  if (!isBioimpedance && (input.bodyFat || input.muscleMass)) {
    throw new BadRequestException(
      'La grasa corporal y la masa muscular solo aplican a una medición de bioimpedancia',
    );
  }

  for (const [label, value] of [
    ['grasa corporal', input.bodyFat],
    ['masa muscular', input.muscleMass],
  ] as const) {
    if (!value) continue;
    if (value.unit === 'PERCENTAGE' && (value.value < 1 || value.value > 80)) {
      throw new BadRequestException(`El % de ${label} debe estar entre 1 y 80`);
    }
    if (value.unit === 'KG' && value.value >= input.weight) {
      throw new BadRequestException(`Los kg de ${label} deben ser menores que el peso`);
    }
  }
}

// Columnas de measurement_results con los valores ingresados, en la unidad ingresada (la otra
// queda en null: la conversión y las clasificaciones son parte de las fórmulas pendientes).
export function toBioimpedanceResults(
  bodyFat: MeasurementValueInput | undefined,
  muscleMass: MeasurementValueInput | undefined,
): MeasurementResultsInput {
  return {
    ...(bodyFat
      ? {
          bfPercentage: bodyFat.unit === 'PERCENTAGE' ? bodyFat.value : null,
          bfKg: bodyFat.unit === 'KG' ? bodyFat.value : null,
          bfMethod: BIOIMPEDANCE_METHOD,
        }
      : {}),
    ...(muscleMass
      ? {
          mmPercentage: muscleMass.unit === 'PERCENTAGE' ? muscleMass.value : null,
          mmKg: muscleMass.unit === 'KG' ? muscleMass.value : null,
          mmMethod: BIOIMPEDANCE_METHOD,
        }
      : {}),
  };
}

// Valor guardado (grasa o masa muscular) en la unidad en que se ingresó; undefined si no hay.
export function storedValue(
  results: MeasurementResultsEntity | undefined,
  kind: 'bf' | 'mm',
): MeasurementValueInput | undefined {
  if (!results) return undefined;
  const percentage = kind === 'bf' ? results.bfPercentage : results.mmPercentage;
  const kg = kind === 'bf' ? results.bfKg : results.mmKg;
  if (percentage != null) return { value: percentage, unit: 'PERCENTAGE' };
  if (kg != null) return { value: kg, unit: 'KG' };
  return undefined;
}
