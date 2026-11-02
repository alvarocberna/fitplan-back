import { NutritionPlanDto } from '../../../../domain/dtos/nutrition-plan.dto';
import { FOOD_FIELD_TO_GROUP } from '../../../../domain/services/alimentos/food-portions';
import { SupplementPrescription } from '../../../../domain/services/formulas/requirements/supplements.service';
import {
  JsonSchema,
  NamedJsonSchema,
  strictObject,
} from '../../../../domain/services/llm/json-schema';

// Forma de la respuesta del modelo al generar el plan, y su esquema ("structured output"). El tipo y
// el esquema describen lo MISMO y deben cambiar juntos (generated-plan.schema.spec.ts lo comprueba).
// El esquema garantiza la estructura; que el contenido sea correcto (porciones que calcen, 3 ejemplos
// por comida) lo valida el caso de uso (plan-validation.ts).

// Desglose verificable de un ejemplo: por cada alimento que la IA usó en "text", declara a qué grupo
// pertenece, cuál es, y cuántos gramos le asignó. Permite validar en código que "text" respeta
// EXACTAMENTE las porciones calculadas, sin tener que parsear el texto libre (ver meal-times.prompt.ts).
export type GeneratedExampleComponent = {
  field: string;
  food: string;
  weight: number;
};

export type GeneratedExample = {
  text: string;
  components: GeneratedExampleComponent[];
};

// Una opción de "equivalences": un único alimento de un grupo, ya escalado a la cantidad de porciones
// que le corresponde a ese grupo (misma lógica que GeneratedExampleComponent, pero para un solo
// alimento en vez de una combinación).
export type GeneratedEquivalenceOption = {
  text: string;
  food: string;
  weight: number;
};

export type GeneratedEquivalenceGroup = {
  field: string;
  options: GeneratedEquivalenceOption[];
};

export type GeneratedMealTime = {
  hour: string | null;
  examples: GeneratedExample[];
  equivalences: GeneratedEquivalenceGroup[];
  comments: string[];
};

export type GeneratedNutritionPlan = {
  prescription: {
    regimen: string;
    goal: string;
  };
  mealTimes: GeneratedMealTime[];
  supplements: SupplementPrescription[];
  sportsRecommendations: NutritionPlanDto['sportsRecommendations'];
};

const string: JsonSchema = { type: 'string' };
const number: JsonSchema = { type: 'number' };
const nullableString: JsonSchema = { type: ['string', 'null'] };
const stringList: JsonSchema = { type: 'array', items: string };

// Grupo de alimentos: solo los que existen en el catálogo. Un grupo inventado deja de ser posible.
const foodField: JsonSchema = {
  type: 'string',
  enum: Object.keys(FOOD_FIELD_TO_GROUP),
};

// Las piezas de un tiempo de comida que redacta el modelo. Las reutiliza el esquema de corrección
// (repaired-meal-times.schema.ts), que pide lo mismo solo para las comidas con error.
export const GENERATED_MEAL_TIME_PROPERTIES: Record<string, JsonSchema> = {
  hour: { type: ['string', 'null'], description: 'Hora aproximada, ej "10am"' },
  examples: {
    type: 'array',
    description: 'Exactamente 3 combinaciones de alimentos',
    items: strictObject({
      text: string,
      components: {
        type: 'array',
        items: strictObject({ field: foodField, food: string, weight: number }),
      },
    }),
  },
  equivalences: {
    type: 'array',
    description: 'Un objeto por cada grupo de alimentos del tiempo de comida',
    items: strictObject({
      field: foodField,
      options: {
        type: 'array',
        description: 'Exactamente 3 alimentos alternativos del mismo grupo',
        items: strictObject({ text: string, food: string, weight: number }),
      },
    }),
  },
  comments: stringList,
};

export const GENERATED_PLAN_SCHEMA: NamedJsonSchema = {
  name: 'nutrition_plan',
  schema: strictObject({
    prescription: strictObject({ regimen: string, goal: string }),
    mealTimes: {
      type: 'array',
      description:
        'Mismo orden y cantidad que los tiempos de comida entregados',
      items: strictObject(GENERATED_MEAL_TIME_PROPERTIES),
    },
    supplements: {
      type: 'array',
      items: strictObject({
        supplement: string,
        requirement: number,
        dosageIndication: string,
        intakeIndication: string,
        effects: stringList,
        considerations: stringList,
        intake: strictObject({
          calories: number,
          protein: number,
          carbohydrate: number,
          fat: number,
        }),
      }),
    },
    sportsRecommendations: {
      type: 'array',
      items: strictObject({
        session: nullableString,
        strategy: nullableString,
        preActivity: nullableString,
        duringActivity: nullableString,
        postActivity: nullableString,
      }),
    },
  }),
};
