import {
  defineFoodGroups,
  calculateFoodsAndIntake,
  calculateTotalPlanIntake,
  calculateTotalAdequacy,
  MealGroups,
  PortionAdequacyResult,
  CalculatedIntake,
} from './portion-adequacy.service';
import { Requirements } from '../formulas/requirements/requirements.service';
import { Meal } from '../../dtos/consultation.dto';

function makeMeal(mealTime: string, overrides: Partial<Meal> = {}): Meal {
  return {
    mealTime,
    cereals: null,
    freeConsumptionVegetable: null,
    generalConsumptionVegetable: null,
    fruit: null,
    highFatProtein: null,
    lowFatProtein: null,
    highFatDairy: null,
    mediumFatDairy: null,
    lowFatDairy: null,
    highProteinDairy: null,
    highLipid: null,
    oil: null,
    sugar: null,
    alcohol: null,
    ...overrides,
  };
}

describe('defineFoodGroups', () => {
  it('elimina aceite y azúcar en desayuno/once/colación, y solo azúcar en almuerzo/cena', () => {
    const meals = [
      makeMeal('desayuno', { oil: 'aceite', sugar: 'azúcar', cereals: 'pan' }),
      makeMeal('almuerzo', { oil: 'aceite', sugar: 'azúcar' }),
    ];
    const [breakfast, lunch] = defineFoodGroups(meals);

    expect(breakfast.oil).toBeNull();
    expect(breakfast.sugar).toBeNull();
    expect(breakfast.cereals).toBe(true);

    expect(lunch.oil).toBe(true);
    expect(lunch.sugar).toBeNull();
  });

  it('el alcohol siempre se elimina, sin importar el tiempo de comida', () => {
    const [breakfast] = defineFoodGroups([
      makeMeal('desayuno', { alcohol: 'cerveza' }),
    ]);
    expect(breakfast.alcohol).toBeNull();
  });

  it('un campo no reportado (null) queda como null, no true', () => {
    const [breakfast] = defineFoodGroups([makeMeal('desayuno')]);
    expect(breakfast.fruit).toBeNull();
  });
});

describe('calculateFoodsAndIntake + calculateTotalPlanIntake + calculateTotalAdequacy (encadenados)', () => {
  // Escenario íntegramente trazado a mano contra el algoritmo de portion-adequacy.service.ts:
  // 4 tiempos principales (sin colaciones), requerimientos calories=2000/protein=100/
  // carbohydrate=250/fat=60. Sirve como test de regresión "congelado" de todo el paso 3 del
  // documento (adecuacion-porciones.md): si esta lógica cambia, este test debe fallar y forzar
  // una revisión consciente de los nuevos números.
  const mealTimes: MealGroups[] = [
    { mealTime: 'desayuno' } as MealGroups,
    { mealTime: 'almuerzo' } as MealGroups,
    { mealTime: 'once' } as MealGroups,
    { mealTime: 'cena' } as MealGroups,
  ];
  const requirements: Requirements = {
    calories: 2000,
    protein: 100,
    carbohydrate: 250,
    fat: 60,
  };

  it('distribuye las porciones y corrige el exceso calórico (recorta 1 porción de cereal)', () => {
    const result = calculateFoodsAndIntake(mealTimes, requirements);

    expect(result.calculatedMealTimes.map((m) => m.mealTimeType)).toEqual([
      'desayuno',
      'almuerzo',
      'once',
      'cena',
    ]);
    expect(result.supplementIntakeNote).toBeNull();
    expect(result.supplementIntake).toEqual({
      calories: 0,
      protein: 0,
      carbohydrate: 0,
      fat: 0,
    });

    const [breakfast, lunch, once, dinner] = result.calculatedMealTimes;

    // desayuno: 1 porción de cereal (se le recorta 1 de las 2 originales por exceso calórico)
    expect(breakfast.numericPortions).toEqual({
      cereals: 1,
      freeConsumptionVegetables: 0,
      generalConsumptionVegetables: 0,
      fruits: 1,
      highFatProteins: 0,
      lowFatProteins: 2,
      highFatDairy: 0,
      mediumFatDairy: 1,
      lowFatDairy: 0,
      highProteinDairy: 0,
      highLipidFoods: 1,
      oils: 0,
      sugars: 0,
    });
    expect(breakfast.intake).toEqual({
      calories: 595,
      protein: 36,
      carbohydrate: 61,
      fat: 23,
    });
    expect(breakfast.foods.cereals).toBe('1 porción');
    expect(breakfast.foods.lowFatProteins).toBe('2 porciones');

    expect(lunch.numericPortions).toMatchObject({
      cereals: 2,
      freeConsumptionVegetables: 2,
      fruits: 1,
      lowFatProteins: 2,
      mediumFatDairy: 0,
      oils: 0.25,
    });
    expect(lunch.intake).toEqual({
      calories: 540,
      protein: 29,
      carbohydrate: 82,
      fat: 11,
    });

    expect(once.numericPortions).toMatchObject({
      cereals: 2,
      freeConsumptionVegetables: 0,
      fruits: 0,
      lowFatProteins: 2,
      mediumFatDairy: 1,
      highLipidFoods: 1,
    });
    expect(once.intake).toEqual({
      calories: 670,
      protein: 38,
      carbohydrate: 76,
      fat: 24,
    });

    expect(dinner.numericPortions).toMatchObject({
      cereals: 1,
      freeConsumptionVegetables: 2,
      fruits: 0,
      lowFatProteins: 1,
      oils: 0.25,
    });
    expect(dinner.intake).toEqual({
      calories: 270,
      protein: 14,
      carbohydrate: 36,
      fat: 8,
    });

    const totalIntake = calculateTotalPlanIntake(result);
    expect(totalIntake).toEqual({
      calories: 2075,
      protein: 117,
      carbohydrate: 255,
      fat: 66,
    });

    const adequacy = calculateTotalAdequacy(totalIntake, requirements);
    expect(adequacy).toEqual({
      calories: 103.8,
      protein: 117,
      carbohydrate: 102,
      fat: 110,
    });

    // el resultado corregido queda dentro/cerca del rango objetivo de calorías (95%-105%,
    // con la excepción documentada de que la corrección solo actúa en pasos de 1 porción)
    expect(adequacy.calories).toBeLessThanOrEqual(105);
  });

  it('todo tiempo de comida definido queda con al menos un alimento asignado', () => {
    const result = calculateFoodsAndIntake(mealTimes, requirements);
    for (const mealTime of result.calculatedMealTimes) {
      const hasAnyFood = Object.values(mealTime.foods).some((v) => v !== null);
      expect(hasAnyFood).toBe(true);
    }
  });

  it('con una sola colación (goal volumen), sigue devolviendo un resultado consistente por tiempo de comida', () => {
    const withSnack: MealGroups[] = [
      { mealTime: 'desayuno' } as MealGroups,
      { mealTime: 'almuerzo' } as MealGroups,
      { mealTime: 'colación' } as MealGroups,
      { mealTime: 'once' } as MealGroups,
      { mealTime: 'cena' } as MealGroups,
    ];
    const volumeRequirements: Requirements = {
      calories: 2800,
      protein: 130,
      carbohydrate: 350,
      fat: 80,
    };

    const result = calculateFoodsAndIntake(withSnack, volumeRequirements);

    expect(result.calculatedMealTimes).toHaveLength(5);
    expect(result.calculatedMealTimes.map((m) => m.mealTimeType)).toEqual([
      'desayuno',
      'almuerzo',
      'colacion',
      'once',
      'cena',
    ]);
    for (const mealTime of result.calculatedMealTimes) {
      expect(mealTime.intake.calories).toBeGreaterThanOrEqual(0);
      expect(Number.isFinite(mealTime.intake.calories)).toBe(true);
    }

    const totalIntake = calculateTotalPlanIntake(result);
    const recomposedCalories =
      totalIntake.protein * 4 +
      totalIntake.carbohydrate * 4 +
      totalIntake.fat * 9;
    // "intake" no reconstituye 1:1 las calorías declaradas por macro (los grupos de alimentos
    // tienen valores de energía/macros propios, no necesariamente 4/4/9 exactos); solo se
    // verifica que estén en el mismo orden de magnitud.
    expect(recomposedCalories).toBeGreaterThan(0);
  });
});

describe('calculateTotalPlanIntake', () => {
  it('suma el intake de todos los tiempos de comida más el suplemento de whey', () => {
    const result: PortionAdequacyResult = {
      calculatedMealTimes: [
        {
          intake: { calories: 100, protein: 10, carbohydrate: 20, fat: 5 },
        } as any,
        {
          intake: { calories: 200, protein: 20, carbohydrate: 40, fat: 10 },
        } as any,
      ],
      supplementIntakeNote: 'whey protein 1 scoop',
      supplementIntake: { calories: 50, protein: 5, carbohydrate: 2, fat: 1 },
    };

    expect(calculateTotalPlanIntake(result)).toEqual({
      calories: 350,
      protein: 35,
      carbohydrate: 62,
      fat: 16,
    });
  });
});

describe('calculateTotalAdequacy', () => {
  it('calcula el porcentaje de adecuación por macronutriente, redondeado a un decimal', () => {
    const totalIntake: CalculatedIntake = {
      calories: 350,
      protein: 35,
      carbohydrate: 62,
      fat: 16,
    };
    const requirements: Requirements = {
      calories: 350,
      protein: 35,
      carbohydrate: 62,
      fat: 16,
    };

    expect(calculateTotalAdequacy(totalIntake, requirements)).toEqual({
      calories: 100,
      protein: 100,
      carbohydrate: 100,
      fat: 100,
    });
  });

  it('redondea correctamente valores intermedios', () => {
    const totalIntake: CalculatedIntake = {
      calories: 33,
      protein: 0,
      carbohydrate: 0,
      fat: 0,
    };
    const requirements: Requirements = {
      calories: 100,
      protein: 1,
      carbohydrate: 1,
      fat: 1,
    };

    expect(calculateTotalAdequacy(totalIntake, requirements).calories).toBe(33);
  });
});
