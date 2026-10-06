import {
  FOOD_FIELD_TO_GROUP,
  FOOD_GROUP_PORTIONS,
} from '../../../domain/services/alimentos/food-portions';
import { CalculatedMealTime } from '../../../domain/services/alimentos/portion-adequacy.service';
import { GeneratedMealTime } from './schemas/generated-plan.schema';

// Validación de CONTENIDO de lo que redactó el modelo: que los ejemplos y las equivalencias de cada
// tiempo de comida respeten exactamente las porciones ya calculadas por código. (La ESTRUCTURA de la
// respuesta la garantiza el esquema, ver schemas/generated-plan.schema.ts.)
//
// No lanza: junta TODOS los problemas, cada uno con el tiempo de comida al que pertenece, para poder
// pedirle al modelo que corrija solo esas comidas (reintento dirigido) en vez de rehacer el plan.

// Tolerancia (en porciones) al comparar lo que la IA reporta en "components" contra las porciones
// exactas ya calculadas por código: cubre solo errores de redondeo de punto flotante, no errores reales
// de escalamiento.
export const PORTION_TOLERANCE = 0.05;

// Cantidad exacta de ejemplos por tiempo de comida y de opciones por grupo de equivalencias.
const EXAMPLES_PER_MEAL_TIME = 3;
const OPTIONS_PER_EQUIVALENCE = 3;

export interface PlanIssue {
  // posición del tiempo de comida en el plan (alineada con calculatedMealTimes)
  mealTimeIndex: number;
  // nombre del tiempo de comida (desayuno, almuerzo, ...)
  mealTimeType: string;
  scope: 'examples' | 'equivalences';
  message: string;
}

// Lanzado cuando la respuesta del modelo no calza con las porciones calculadas y ya no queda nada que
// corregir. Es una subclase de Error para distinguir en los logs un reintento por "la IA se equivocó
// en el escalamiento" de un reintento por otro motivo (timeout, rate limit, etc).
export class PlanValidationError extends Error {
  constructor(
    message: string,
    public readonly issues: PlanIssue[] = [],
  ) {
    super(message);
    this.name = 'PlanValidationError';
  }
}

// Dado un alimento concreto que la IA reportó ({field, food, weight}), busca su gramaje base de 1
// porción en el catálogo y devuelve cuántas porciones representa ese peso. `portions: null` si el
// alimento no tiene gramaje base definido (algunos de "libre consumo", como ajo o zapallo italiano
// crudo): no se puede validar la proporción exacta, así que basta con que el alimento esté presente.
// `error` si el grupo no existe o el alimento no pertenece a ese grupo.
function implicitPortions(
  field: string,
  food: string,
  weight: number,
): { portions: number | null } | { error: string } {
  const groupInfo = FOOD_FIELD_TO_GROUP[field];
  if (!groupInfo) return { error: `campo "${field}" no existe` };
  const groupData = FOOD_GROUP_PORTIONS.find(
    (g) => g.group === groupInfo.group && g.subcategory === groupInfo.subcategory,
  );
  const foodData = groupData?.foods.find(
    (f) => f.food.toLowerCase() === food.toLowerCase(),
  );
  if (!foodData) return { error: `alimento "${food}" no pertenece al grupo "${field}"` };
  if (!foodData.weight) return { portions: null };
  return { portions: weight / foodData.weight };
}

function requiredPortionsOf(calculated: CalculatedMealTime): Record<string, number> {
  return calculated.numericPortions as unknown as Record<string, number>;
}

function examplesIssues(calculated: CalculatedMealTime, generated: GeneratedMealTime | undefined): string[] {
  const examples = generated?.examples ?? [];
  if (examples.length !== EXAMPLES_PER_MEAL_TIME) {
    return [`se esperaban ${EXAMPLES_PER_MEAL_TIME} ejemplos, se recibieron ${examples.length}`];
  }

  const requiredByField = requiredPortionsOf(calculated);
  const messages: string[] = [];

  examples.forEach((example, exampleIndex) => {
    const context = `ejemplo ${exampleIndex + 1}`;
    const usedPortionsByField: Record<string, number> = {};
    const fieldsWithoutBaseWeight = new Set<string>();
    let hasInvalidComponent = false;

    for (const component of example.components) {
      const result = implicitPortions(component.field, component.food, component.weight);
      if ('error' in result) {
        messages.push(`${context}: ${result.error}`);
        hasInvalidComponent = true;
        continue;
      }
      if (result.portions === null) {
        fieldsWithoutBaseWeight.add(component.field);
        continue;
      }
      usedPortionsByField[component.field] =
        (usedPortionsByField[component.field] ?? 0) + result.portions;
    }
    // con un componente inválido las sumas no son confiables: se informa solo ese error
    if (hasInvalidComponent) return;

    for (const [field, required] of Object.entries(requiredByField)) {
      if (!required || fieldsWithoutBaseWeight.has(field)) continue;
      const used = usedPortionsByField[field] ?? 0;
      if (Math.abs(used - required) > PORTION_TOLERANCE) {
        messages.push(
          `${context}: el grupo "${field}" requiere ${required} porciones y el ejemplo usa ${used.toFixed(2)}`,
        );
      }
    }

    for (const field of Object.keys(usedPortionsByField)) {
      if (!requiredByField[field]) {
        messages.push(
          `${context}: usa el grupo "${field}", que no corresponde a este tiempo de comida`,
        );
      }
    }
  });

  return messages;
}

function equivalencesIssues(calculated: CalculatedMealTime, generated: GeneratedMealTime | undefined): string[] {
  const requiredByField = requiredPortionsOf(calculated);
  const requiredFields = Object.entries(requiredByField)
    .filter(([, required]) => !!required)
    .map(([field]) => field);
  const equivalenceByField = new Map(
    (generated?.equivalences ?? []).map((group) => [group.field, group]),
  );
  const messages: string[] = [];

  for (const field of requiredFields) {
    const context = `equivalencias de "${field}"`;
    const generatedGroup = equivalenceByField.get(field);
    if (!generatedGroup) {
      messages.push(`${context}: falta el desglose de equivalencias para este grupo`);
      continue;
    }
    if (generatedGroup.options.length !== OPTIONS_PER_EQUIVALENCE) {
      messages.push(
        `${context}: se esperaban ${OPTIONS_PER_EQUIVALENCE} opciones, se recibieron ${generatedGroup.options.length}`,
      );
      continue;
    }

    const usedFoods = new Set<string>();
    for (const option of generatedGroup.options) {
      const normalizedFood = option.food.toLowerCase();
      if (usedFoods.has(normalizedFood)) {
        messages.push(`${context}: el alimento "${option.food}" está repetido entre las 3 opciones`);
        continue;
      }
      usedFoods.add(normalizedFood);

      const result = implicitPortions(field, option.food, option.weight);
      if ('error' in result) {
        messages.push(`${context}: ${result.error}`);
        continue;
      }
      if (result.portions === null) continue;
      const required = requiredByField[field];
      if (Math.abs(result.portions - required) > PORTION_TOLERANCE) {
        messages.push(
          `${context}: "${option.food}" debería representar ${required} porciones y representa ${result.portions.toFixed(2)}`,
        );
      }
    }
  }

  return messages;
}

// Compara lo que redactó el modelo contra lo calculado, tiempo de comida por tiempo de comida
// (alineados por índice). Lista vacía = el plan es válido.
export function collectPlanIssues(
  calculatedMealTimes: CalculatedMealTime[],
  generatedMealTimes: GeneratedMealTime[],
): PlanIssue[] {
  return calculatedMealTimes.flatMap((calculated, mealTimeIndex) => {
    const generated = generatedMealTimes[mealTimeIndex];
    const base = { mealTimeIndex, mealTimeType: calculated.mealTimeType };
    return [
      ...examplesIssues(calculated, generated).map((message) => ({
        ...base,
        scope: 'examples' as const,
        message,
      })),
      ...equivalencesIssues(calculated, generated).map((message) => ({
        ...base,
        scope: 'equivalences' as const,
        message,
      })),
    ];
  });
}

// Índices (sin repetir, en orden) de los tiempos de comida que tienen algún problema.
export function mealTimeIndexesWithIssues(issues: PlanIssue[]): number[] {
  return [...new Set(issues.map((issue) => issue.mealTimeIndex))].sort((a, b) => a - b);
}

// Texto de un problema para logs y para el mensaje de PlanValidationError.
export function describeIssue(issue: PlanIssue): string {
  return `Tiempo "${issue.mealTimeType}" (índice ${issue.mealTimeIndex}): ${issue.message}`;
}
