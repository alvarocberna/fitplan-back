import {
  NamedJsonSchema,
  strictObject,
} from '../../../../domain/services/llm/json-schema';

// Clasificación previa a la generación: nivel de actividad física y objetivo. Ambos valores entran
// directo a las fórmulas (gasto energético, tiempos de comida, proyección), así que se restringen a
// los únicos que el código sabe interpretar: cualquier otro produciría un plan mal calculado.
export const PHYSICAL_ACTIVITY_LEVELS = [1.4, 1.5, 1.6] as const;
export const PLAN_GOALS = ['definicion', 'mantencion', 'volumen'] as const;

export type ExtractedInfo = {
  physicalActivityLevel: (typeof PHYSICAL_ACTIVITY_LEVELS)[number];
  goal: (typeof PLAN_GOALS)[number];
};

export const EXTRACT_INFO_SCHEMA: NamedJsonSchema = {
  name: 'consultation_classification',
  schema: strictObject({
    physicalActivityLevel: { type: 'number', enum: PHYSICAL_ACTIVITY_LEVELS },
    goal: { type: 'string', enum: PLAN_GOALS },
  }),
};
