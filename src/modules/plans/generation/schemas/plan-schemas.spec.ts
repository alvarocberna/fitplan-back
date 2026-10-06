import { FOOD_FIELD_TO_GROUP } from '../../../../domain/services/alimentos/food-portions';
import {
  strictSchemaViolations,
  validateJsonSchema,
} from '../../../../domain/services/llm/json-schema';
import { EXTRACT_INFO_SCHEMA, ExtractedInfo } from './extract-info.schema';
import { GENERATED_PLAN_SCHEMA, GeneratedNutritionPlan } from './generated-plan.schema';
import { REPAIRED_MEAL_TIMES_SCHEMA, RepairedMealTimes } from './repaired-meal-times.schema';

// Los tipos y los esquemas describen lo mismo y se mantienen a mano: estos tests fallan si se
// desalinean (una respuesta tipada debe cumplir su esquema) o si un esquema deja de ser válido para
// el modo estricto del proveedor (que respondería 400 en cada llamada).

const mealTime: GeneratedNutritionPlan['mealTimes'][number] = {
  hour: '8am',
  examples: [
    {
      text: '1 taza de avena con leche',
      components: [{ field: 'cereals', food: 'Avena', weight: 40 }],
    },
  ],
  equivalences: [
    { field: 'cereals', options: [{ text: '1/2 taza de avena', food: 'Avena', weight: 40 }] },
  ],
  comments: ['Tomar agua'],
};

const plan: GeneratedNutritionPlan = {
  prescription: { regimen: 'Hipocalórico', goal: 'Definición' },
  mealTimes: [mealTime, { ...mealTime, hour: null }],
  supplements: [
    {
      supplement: 'Creatina',
      requirement: 3,
      dosageIndication: '3 gr/día',
      intakeIndication: 'Con agua',
      effects: ['Rendimiento'],
      considerations: ['Retención de líquido'],
      intake: { calories: 0, protein: 0, carbohydrate: 0, fat: 0 },
    },
  ],
  sportsRecommendations: [
    {
      session: 'Gimnasio',
      strategy: null,
      preActivity: 'Fruta',
      duringActivity: null,
      postActivity: 'Batido',
    },
  ],
};

const repaired: RepairedMealTimes = { mealTimes: [{ index: 2, ...mealTime }] };
const extracted: ExtractedInfo = { physicalActivityLevel: 1.5, goal: 'volumen' };

describe('esquemas de structured output', () => {
  it.each([
    ['plan', GENERATED_PLAN_SCHEMA],
    ['corrección de tiempos de comida', REPAIRED_MEAL_TIMES_SCHEMA],
    ['clasificación previa', EXTRACT_INFO_SCHEMA],
  ])('el esquema de %s cumple las reglas del modo estricto y tiene un nombre válido', (_name, named) => {
    expect(strictSchemaViolations(named.schema)).toEqual([]);
    expect(named.name).toMatch(/^[a-zA-Z0-9_-]{1,64}$/);
  });

  it('una respuesta tipada de cada tipo cumple su esquema', () => {
    expect(validateJsonSchema(plan, GENERATED_PLAN_SCHEMA.schema)).toEqual([]);
    expect(validateJsonSchema(repaired, REPAIRED_MEAL_TIMES_SCHEMA.schema)).toEqual([]);
    expect(validateJsonSchema(extracted, EXTRACT_INFO_SCHEMA.schema)).toEqual([]);
  });

  it('el plan acepta todos los grupos de alimentos del catálogo y rechaza uno inventado', () => {
    for (const field of Object.keys(FOOD_FIELD_TO_GROUP)) {
      const withField = {
        ...plan,
        mealTimes: [{ ...mealTime, equivalences: [{ field, options: [] }] }],
      };
      expect(validateJsonSchema(withField, GENERATED_PLAN_SCHEMA.schema)).toEqual([]);
    }

    const invented = {
      ...plan,
      mealTimes: [{ ...mealTime, equivalences: [{ field: 'legumbres', options: [] }] }],
    };
    const errors = validateJsonSchema(invented, GENERATED_PLAN_SCHEMA.schema);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('$.mealTimes[0].equivalences[0].field');
  });

  it('el plan rechaza un tiempo de comida sin "examples" y un gramaje que no es número', () => {
    const { examples: _examples, ...withoutExamples } = mealTime;
    const broken = {
      ...plan,
      mealTimes: [
        withoutExamples,
        {
          ...mealTime,
          examples: [{ text: 'x', components: [{ field: 'cereals', food: 'Avena', weight: '40g' }] }],
        },
      ],
    };

    expect(validateJsonSchema(broken, GENERATED_PLAN_SCHEMA.schema)).toEqual([
      '$.mealTimes[0].examples: falta el campo',
      '$.mealTimes[1].examples[0].components[0].weight: se esperaba number, llegó string',
    ]);
  });

  it('la corrección exige el "index" entero de cada tiempo de comida', () => {
    expect(
      validateJsonSchema({ mealTimes: [mealTime] }, REPAIRED_MEAL_TIMES_SCHEMA.schema),
    ).toEqual(['$.mealTimes[0].index: falta el campo']);
    expect(
      validateJsonSchema({ mealTimes: [{ index: '2', ...mealTime }] }, REPAIRED_MEAL_TIMES_SCHEMA.schema),
    ).toEqual(['$.mealTimes[0].index: se esperaba integer, llegó string']);
  });

  it('la clasificación previa solo admite los niveles de actividad y objetivos que usan las fórmulas', () => {
    expect(
      validateJsonSchema({ physicalActivityLevel: 1.2, goal: 'volumen' }, EXTRACT_INFO_SCHEMA.schema),
    ).toHaveLength(1);
    expect(
      validateJsonSchema({ physicalActivityLevel: 1.4, goal: 'bajar' }, EXTRACT_INFO_SCHEMA.schema),
    ).toHaveLength(1);
  });
});
