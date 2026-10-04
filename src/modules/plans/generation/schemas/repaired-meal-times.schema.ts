import {
  NamedJsonSchema,
  strictObject,
} from '../../../../domain/services/llm/json-schema';
import {
  GENERATED_MEAL_TIME_PROPERTIES,
  GeneratedMealTime,
} from './generated-plan.schema';

// Respuesta del modelo a una corrección dirigida (reintento dirigido): solo los tiempos de comida que
// se le pidió corregir, cada uno con el índice que tiene en el plan.
export type RepairedMealTime = GeneratedMealTime & { index: number };

export type RepairedMealTimes = {
  mealTimes: RepairedMealTime[];
};

export const REPAIRED_MEAL_TIMES_SCHEMA: NamedJsonSchema = {
  name: 'repaired_meal_times',
  schema: strictObject({
    mealTimes: {
      type: 'array',
      description: 'Solo los tiempos de comida que se pidió corregir',
      items: strictObject({
        index: {
          type: 'integer',
          description: 'El mismo "index" del tiempo de comida que se está corrigiendo',
        },
        ...GENERATED_MEAL_TIME_PROPERTIES,
      }),
    },
  }),
};
