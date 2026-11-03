// Reglas de entrada compartidas por registrar (CU-CLI-05) y corregir (CU-CLI-06) una medición: las
// que cruzan campos y no se pueden expresar con class-validator.

import { BadRequestException } from '@nestjs/common';
import { MeasurementLevel } from '../../domain/entities/enums';
import { MeasurementValueInput } from '../../domain';
import { MeasurementResultsEntity } from '../../domain/entities/measurements.entity';

export type { MeasurementValueInput };

export interface MeasurementInput {
  level: MeasurementLevel | null;
  measuredAt: Date;
  weight: number;
  bodyFat?: MeasurementValueInput;
  muscleMass?: MeasurementValueInput;
  visceralFat?: MeasurementValueInput;
  boneMass?: MeasurementValueInput;
}

// Componentes de una bioimpedancia: prefijo de sus columnas en measurement_results y nombre para
// los mensajes de error.
export type MeasurementComponent = 'bf' | 'mm' | 'vf' | 'bm';

const COMPONENT_LABELS: Record<MeasurementComponent, string> = {
  bf: 'grasa corporal',
  mm: 'masa muscular',
  vf: 'grasa visceral',
  bm: 'masa ósea',
};

export function assertValidMeasurementInput(input: MeasurementInput): void {
  if (input.measuredAt.getTime() > Date.now()) {
    throw new BadRequestException(
      'La fecha de la medición no puede ser futura',
    );
  }

  const components: [
    MeasurementComponent,
    MeasurementValueInput | undefined,
  ][] = [
    ['bf', input.bodyFat],
    ['mm', input.muscleMass],
    ['vf', input.visceralFat],
    ['bm', input.boneMass],
  ];

  const isBioimpedance = input.level === MeasurementLevel.BIOIMPEDANCE;
  if (isBioimpedance && (!input.bodyFat || !input.muscleMass)) {
    throw new BadRequestException(
      'Una medición de bioimpedancia requiere grasa corporal y masa muscular',
    );
  }
  if (!isBioimpedance && components.some(([, value]) => value)) {
    throw new BadRequestException(
      'La grasa corporal, la masa muscular, la grasa visceral y la masa ósea solo aplican a una medición de bioimpedancia',
    );
  }

  for (const [component, value] of components) {
    if (!value) continue;
    const label = COMPONENT_LABELS[component];
    if (value.unit === 'PERCENTAGE' && (value.value < 1 || value.value > 80)) {
      throw new BadRequestException(`El % de ${label} debe estar entre 1 y 80`);
    }
    if (value.unit === 'KG' && value.value >= input.weight) {
      throw new BadRequestException(
        `Los kg de ${label} deben ser menores que el peso`,
      );
    }
  }
}

// Valor guardado de un componente para recalcular una medición editada: el %, que es la fuente de
// verdad (si cambia el peso se recalculan los kg); los kg solo si no hay % guardado. undefined si
// no hay.
export function storedValue(
  results: MeasurementResultsEntity | undefined,
  component: MeasurementComponent,
): MeasurementValueInput | undefined {
  if (!results) return undefined;
  const percentage = results[`${component}Percentage`];
  const kg = results[`${component}Kg`];
  if (percentage != null) return { value: percentage, unit: 'PERCENTAGE' };
  if (kg != null) return { value: kg, unit: 'KG' };
  return undefined;
}
