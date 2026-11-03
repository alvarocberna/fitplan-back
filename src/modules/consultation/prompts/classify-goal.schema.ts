import {
  NamedJsonSchema,
  strictObject,
} from '../../../domain/services/llm/json-schema';

// Respuesta de la clasificación del objetivo (CU-CON-03): uno de tres valores. Mismo criterio que la
// clasificación de la generación del plan (plans/generation/schemas/extract-info.schema.ts):
// consultation no puede importar de plans, así que se replica acá. Si cambia una, cambiar la otra.
export const CLASSIFIED_GOALS = [
  'definicion',
  'mantencion',
  'volumen',
] as const;

export type ClassifiedGoal = { goal: (typeof CLASSIFIED_GOALS)[number] };

export const CLASSIFY_GOAL_SCHEMA: NamedJsonSchema = {
  name: 'goal_classification',
  schema: strictObject({
    goal: { type: 'string', enum: CLASSIFIED_GOALS },
  }),
};
