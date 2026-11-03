import { mapPlanToNutritionalPlanDto } from './plan-generation.mapper';
import { NutritionPlanDto } from '../../../domain/dtos/nutrition-plan.dto';
import { NumericMealTimePortions } from '../../../domain/services/alimentos/portion-adequacy.service';

const NO_PORTIONS: NumericMealTimePortions = {
  cereals: 0,
  freeConsumptionVegetables: 0,
  generalConsumptionVegetables: 0,
  fruits: 0,
  highFatProteins: 0,
  lowFatProteins: 0,
  highFatDairy: 0,
  mediumFatDairy: 0,
  lowFatDairy: 0,
  highProteinDairy: 0,
  highLipidFoods: 0,
  oils: 0,
  sugars: 0,
};

const NO_FOODS = Object.fromEntries(
  Object.keys(NO_PORTIONS).map((group) => [group, null]),
) as NutritionPlanDto['mealTimes'][number]['foods'];

describe('mapPlanToNutritionalPlanDto', () => {
  const plan = {
    prescription: {
      regimen: 'Régimen hipocalórico hiperproteico.',
      goal: 'Bajar de peso',
      calories: 2000,
      protein: 150,
      carbohydrate: 200,
      fat: 60,
    },
    planIntake: {
      adequacy: { calories: 98, protein: 99, carbohydrate: 97, fat: 101 },
      totalIntake: {
        calories: 1960,
        protein: 148.5,
        carbohydrate: 194,
        fat: 60.6,
      },
    },
    mealTimes: [
      {
        description: { time: 'desayuno', hour: '8am' },
        intake: { calories: 400, protein: 20, carbohydrate: 50, fat: 10 },
        foods: {
          ...NO_FOODS,
          cereals: {
            portion: '2 porciones',
            equivalence: 'pan 1 unidad (100gr), avena 1 taza (80gr)',
          },
          lowFatDairy: { portion: '1 porción', equivalence: '' },
        },
        examples: ['Pan con quesillo', 'Avena con leche', 'Tostadas'],
        comments: ['Preferir pan integral'],
      },
      {
        description: { time: 'colacion', hour: null },
        intake: { calories: 100, protein: 2, carbohydrate: 20, fat: 1 },
        foods: {
          ...NO_FOODS,
          fruits: { portion: '1 porción', equivalence: 'manzana 1 unidad' },
        },
        examples: ['Una manzana'],
        comments: [],
      },
    ],
    supplements: [
      {
        supplement: 'Creatina',
        requirement: 5,
        dosageIndication: '5 g al día',
        intakeIndication: 'Con el desayuno',
        effects: ['Mejora la fuerza'],
        considerations: ['Hidratarse bien', 'Evitar si hay daño renal'],
        intake: { calories: 0, protein: 0, carbohydrate: 0, fat: 0 },
      },
      {
        supplement: 'Whey protein',
        requirement: 30,
        dosageIndication: '1 scoop',
        intakeIndication: 'Post entrenamiento',
        effects: [],
        considerations: [],
        intake: { calories: 120, protein: 24, carbohydrate: 3, fat: 1.5 },
      },
    ],
    sportsRecommendations: [
      {
        session: 'Gimnasio',
        strategy: 'Aportar energía',
        preActivity: 'Plátano',
        duringActivity: null,
        postActivity: 'Batido de proteína',
      },
    ],
  } as unknown as NutritionPlanDto;

  const numericPortions: NumericMealTimePortions[] = [
    { ...NO_PORTIONS, cereals: 2, lowFatDairy: 1 },
    { ...NO_PORTIONS, fruits: 1 },
  ];

  it('mapea prescription a los *Requirement y planIntake.totalIntake a los *Intake (fat → lipid)', () => {
    const startDate = new Date('2026-09-25T00:00:00Z');
    const endDate = new Date('2026-12-25T00:00:00Z');
    const result = mapPlanToNutritionalPlanDto(
      plan,
      'Plan personalizado',
      numericPortions,
      startDate,
      endDate,
    );

    expect(result).toMatchObject({
      planName: 'Plan personalizado',
      period: null,
      mainPlan: true,
      startDate,
      endDate,
      goal: 'Bajar de peso',
      dietRegimen: 'Régimen hipocalórico hiperproteico.',
      calorieRequirement: 2000,
      proteinRequirement: 150,
      carbohydrateRequirement: 200,
      lipidRequirement: 60,
      calorieIntake: 1960,
      proteinIntake: 148.5,
      carbohydrateIntake: 194,
      lipidIntake: 60.6,
    });
  });

  it('usa la fecha actual como startDate por defecto y un planName por defecto si viene null', () => {
    const result = mapPlanToNutritionalPlanDto(plan, null, numericPortions);

    expect(result.planName).toBe('Plan Nutricional Personalizado');
    expect(result.startDate).toBeInstanceOf(Date);
    expect(result.endDate).toBeNull();
  });

  describe('tiempos de comida', () => {
    const [breakfast, snack] = mapPlanToNutritionalPlanDto(
      plan,
      null,
      numericPortions,
    ).mealTimes;

    it('mapea el tiempo al enum, la hora y el intake (fat → fatIntake)', () => {
      expect(breakfast).toMatchObject({
        time: 'BREAKFAST',
        hour: '8am',
        calorieIntake: 400,
        proteinIntake: 20,
        carbohydrateIntake: 50,
        fatIntake: 10,
      });
      expect(snack).toMatchObject({ time: 'SNACK', hour: null });
    });

    it('toma las porciones numéricas calculadas por grupo, con 0 porciones como null', () => {
      expect(breakfast).toMatchObject({
        cereal: 2,
        lowFatDairy: 1,
        fruit: null,
        lipidRich: null,
        oil: null,
        sugar: null,
      });
      expect(snack.fruit).toBe(1);
      expect(snack.cereal).toBeNull();
    });

    it('guarda ejemplos, comentarios y equivalencias (con el grupo como prefijo) como notas', () => {
      expect(breakfast.notes).toEqual([
        { note: 'Pan con quesillo', type: 'EXAMPLE' },
        { note: 'Avena con leche', type: 'EXAMPLE' },
        { note: 'Tostadas', type: 'EXAMPLE' },
        { note: 'Preferir pan integral', type: 'COMMENT' },
        {
          note: 'cereals: pan 1 unidad (100gr), avena 1 taza (80gr)',
          type: 'EQUIVALENCE',
        },
      ]);
      // una equivalencia vacía no genera nota
      expect(
        breakfast.notes.filter((n) => n.note.startsWith('lowFatDairy')),
      ).toHaveLength(0);
    });

    it('lanza si el tiempo de comida no es uno conocido', () => {
      const badPlan = {
        ...plan,
        mealTimes: [
          { ...plan.mealTimes[0], description: { time: 'brunch', hour: null } },
        ],
      } as NutritionPlanDto;

      expect(() =>
        mapPlanToNutritionalPlanDto(badPlan, null, numericPortions),
      ).toThrow(/brunch/);
    });
  });

  it('crea una fila por suplemento, con efectos y consideraciones como notas', () => {
    const { supplements } = mapPlanToNutritionalPlanDto(
      plan,
      null,
      numericPortions,
    );

    expect(supplements).toEqual([
      {
        supplement: 'Creatina',
        requirement: 5,
        doseInstructions: '5 g al día',
        intakeInstructions: 'Con el desayuno',
        calorieIntake: 0,
        proteinIntake: 0,
        carbohydrateIntake: 0,
        fatIntake: 0,
        notes: [
          { note: 'Mejora la fuerza', type: 'EFFECT' },
          { note: 'Hidratarse bien', type: 'CONSIDERATION' },
          { note: 'Evitar si hay daño renal', type: 'CONSIDERATION' },
        ],
      },
      {
        supplement: 'Whey protein',
        requirement: 30,
        doseInstructions: '1 scoop',
        intakeInstructions: 'Post entrenamiento',
        calorieIntake: 120,
        proteinIntake: 24,
        carbohydrateIntake: 3,
        fatIntake: 1.5,
        notes: [],
      },
    ]);
  });

  it('mapea las recomendaciones deportivas 1:1', () => {
    const { sportsRecommendations } = mapPlanToNutritionalPlanDto(
      plan,
      null,
      numericPortions,
    );

    expect(sportsRecommendations).toEqual([
      {
        session: 'Gimnasio',
        strategy: 'Aportar energía',
        preActivity: 'Plátano',
        duringActivity: null,
        postActivity: 'Batido de proteína',
      },
    ]);
  });
});
