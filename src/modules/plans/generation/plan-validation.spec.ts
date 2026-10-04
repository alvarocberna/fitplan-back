import {
  FOOD_FIELD_TO_GROUP,
  FOOD_GROUP_PORTIONS,
} from '../../../domain/services/alimentos/food-portions';
import { CalculatedMealTime } from '../../../domain/services/alimentos/portion-adequacy.service';
import {
  collectPlanIssues,
  describeIssue,
  mealTimeIndexesWithIssues,
} from './plan-validation';
import { GeneratedMealTime } from './schemas/generated-plan.schema';

// alimentos del catálogo (con gramaje de 1 porción) de un grupo
function foodsOf(field: string) {
  const info = FOOD_FIELD_TO_GROUP[field];
  return FOOD_GROUP_PORTIONS.find(
    (g) => g.group === info.group && g.subcategory === info.subcategory,
  )!.foods.filter((f) => f.weight != null);
}

// tiempo de comida calculado con las porciones indicadas (el resto de los grupos en 0)
function calculated(mealTimeType: string, portions: Record<string, number>): CalculatedMealTime {
  const numericPortions = Object.fromEntries(
    Object.keys(FOOD_FIELD_TO_GROUP).map((field) => [field, portions[field] ?? 0]),
  );
  return { mealTimeType, numericPortions } as unknown as CalculatedMealTime;
}

// respuesta del modelo que calza exactamente con esas porciones
function matching(portions: Record<string, number>): GeneratedMealTime {
  const components = Object.entries(portions).map(([field, required]) => {
    const food = foodsOf(field)[0];
    return { field, food: food.food, weight: required * (food.weight as number) };
  });
  const example = { text: 'ejemplo', components };
  return {
    hour: '8am',
    examples: [example, example, example],
    equivalences: Object.entries(portions).map(([field, required]) => ({
      field,
      options: foodsOf(field)
        .slice(0, 3)
        .map((food) => ({
          text: food.food,
          food: food.food,
          weight: required * (food.weight as number),
        })),
    })),
    comments: [],
  };
}

describe('collectPlanIssues', () => {
  const breakfast = { cereals: 2, fruits: 1 };
  const lunch = { cereals: 1.5, lowFatProteins: 2 };
  const calculatedMealTimes = [calculated('desayuno', breakfast), calculated('almuerzo', lunch)];

  it('un plan que calza con las porciones no tiene problemas', () => {
    expect(collectPlanIssues(calculatedMealTimes, [matching(breakfast), matching(lunch)])).toEqual([]);
  });

  it('tolera diferencias de redondeo, no errores reales de escalamiento', () => {
    const cereal = foodsOf('cereals')[0];
    const withWeight = (weight: number): GeneratedMealTime => {
      const base = matching(breakfast);
      const components = base.examples[0].components.map((component) =>
        component.field === 'cereals' ? { ...component, weight } : component,
      );
      return { ...base, examples: base.examples.map((example) => ({ ...example, components })) };
    };
    const exact = 2 * (cereal.weight as number);

    expect(collectPlanIssues([calculatedMealTimes[0]], [withWeight(exact * 1.01)])).toEqual([]);
    expect(collectPlanIssues([calculatedMealTimes[0]], [withWeight(exact * 1.5)])).toHaveLength(3);
  });

  it('junta TODOS los problemas, cada uno con su tiempo de comida y su ámbito', () => {
    const badBreakfast = { ...matching(breakfast), examples: [] };
    const goodLunch = matching(lunch);
    const badLunch: GeneratedMealTime = {
      ...goodLunch,
      equivalences: goodLunch.equivalences.filter((group) => group.field !== 'cereals'),
    };

    const issues = collectPlanIssues(calculatedMealTimes, [badBreakfast, badLunch]);

    expect(issues).toEqual([
      {
        mealTimeIndex: 0,
        mealTimeType: 'desayuno',
        scope: 'examples',
        message: 'se esperaban 3 ejemplos, se recibieron 0',
      },
      {
        mealTimeIndex: 1,
        mealTimeType: 'almuerzo',
        scope: 'equivalences',
        message: 'equivalencias de "cereals": falta el desglose de equivalencias para este grupo',
      },
    ]);
    expect(mealTimeIndexesWithIssues(issues)).toEqual([0, 1]);
    expect(describeIssue(issues[0])).toBe(
      'Tiempo "desayuno" (índice 0): se esperaban 3 ejemplos, se recibieron 0',
    );
  });

  it('un alimento que no pertenece al grupo se informa una vez por ejemplo, sin sumar porciones', () => {
    const base = matching(breakfast);
    const components = base.examples[0].components.map((component) =>
      component.field === 'fruits' ? { ...component, food: 'Alimento inventado' } : component,
    );
    const generated = { ...base, examples: [{ text: 'x', components }, base.examples[1], base.examples[2]] };

    expect(collectPlanIssues([calculatedMealTimes[0]], [generated]).map((issue) => issue.message)).toEqual([
      'ejemplo 1: alimento "Alimento inventado" no pertenece al grupo "fruits"',
    ]);
  });

  it('un ejemplo que usa un grupo que no corresponde al tiempo de comida es un problema', () => {
    const base = matching(breakfast);
    const oil = foodsOf('oils')[0];
    const components = [
      ...base.examples[0].components,
      { field: 'oils', food: oil.food, weight: oil.weight as number },
    ];
    const generated = { ...base, examples: [{ text: 'x', components }, base.examples[1], base.examples[2]] };

    expect(collectPlanIssues([calculatedMealTimes[0]], [generated]).map((issue) => issue.message)).toEqual([
      'ejemplo 1: usa el grupo "oils", que no corresponde a este tiempo de comida',
    ]);
  });

  it('equivalencias: cantidad de opciones, alimentos repetidos y gramaje mal escalado', () => {
    const base = matching(breakfast);
    const [cereals, fruits] = base.equivalences;
    const generated: GeneratedMealTime = {
      ...base,
      equivalences: [
        { ...cereals, options: [cereals.options[0], cereals.options[0], { ...cereals.options[2], weight: 1 }] },
        { ...fruits, options: fruits.options.slice(0, 2) },
      ],
    };

    const messages = collectPlanIssues([calculatedMealTimes[0]], [generated]).map((issue) => issue.message);

    expect(messages).toHaveLength(3);
    expect(messages[0]).toContain('está repetido entre las 3 opciones');
    expect(messages[1]).toContain('debería representar 2 porciones');
    expect(messages[2]).toBe('equivalencias de "fruits": se esperaban 3 opciones, se recibieron 2');
  });

  it('si falta un tiempo de comida en la respuesta, se informa como problema de ese índice', () => {
    const issues = collectPlanIssues(calculatedMealTimes, [matching(breakfast)]);

    expect(mealTimeIndexesWithIssues(issues)).toEqual([1]);
  });
});
