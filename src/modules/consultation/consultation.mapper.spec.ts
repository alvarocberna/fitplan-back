import {
  mapMealDtoToEntity,
  normalizeEventType,
  mapAnamnesisDtoToDetails,
  mapMeasurementsDtoToDetails,
} from './consultation.mapper';
import {
  Meal,
  AnamnesisDto,
  MeasurementsDto,
} from '../../domain/dtos/consultation.dto';

describe('mapMealDtoToEntity', () => {
  it('mapea cada campo de Meal a su equivalente en la entidad, conservando los null', () => {
    const meal: Meal = {
      mealTime: 'desayuno',
      cereals: 'pan',
      freeConsumptionVegetable: null,
      generalConsumptionVegetable: null,
      fruit: 'manzana',
      highFatProtein: null,
      lowFatProtein: 'huevo',
      highFatDairy: null,
      mediumFatDairy: null,
      lowFatDairy: null,
      highProteinDairy: null,
      highLipid: 'palta',
      oil: null,
      sugar: null,
      alcohol: null,
    };

    const result = mapMealDtoToEntity(meal);

    expect(result.mealTime).toBe('desayuno');
    expect(result.mealHour).toBeNull();
    expect(result.description).toBeNull();
    expect(result.cereals).toBe('pan');
    expect(result.fruit).toBe('manzana');
    expect(result.lowFatProtein).toBe('huevo');
    // "highLipid" (DTO) se mapea a "lipidRich" (entidad)
    expect(result.lipidRich).toBe('palta');
    expect(result.freeConsumptionVegetable).toBeNull();
  });
});

describe('normalizeEventType', () => {
  it('detecta "competencia" por substring, ignorando mayúsculas', () => {
    expect(normalizeEventType('Competencia de fin de semana')).toBe(
      'COMPETITION',
    );
  });

  it('detecta "entrenamiento" (o "train") por substring', () => {
    expect(normalizeEventType('entrenamiento de pesas')).toBe('TRAINING');
    expect(normalizeEventType('training session')).toBe('TRAINING');
  });

  it('devuelve null si no coincide con ninguno de los dos, o si es null', () => {
    expect(normalizeEventType('partido amistoso')).toBeNull();
    expect(normalizeEventType(null)).toBeNull();
  });
});

describe('mapAnamnesisDtoToDetails', () => {
  it('devuelve null si la anamnesis es null', () => {
    expect(mapAnamnesisDtoToDetails(null)).toBeNull();
  });

  it('mapea goals, clinical (envolviendo campos únicos en arrays), dietary y lifestyle', () => {
    const anamnesis: AnamnesisDto = {
      goals: { primaryGoal: 'bajar de peso', secondaryGoal: ['tonificar'] },
      clinical: {
        pathology: 'hipotiroidismo',
        familyMedicalHistory: 'diabetes',
        allergies: 'ninguna',
        intolerances: 'lactosa',
        medications: 'ninguno',
        gastrointestinalHistory: null,
        bowelMovements: 'normales',
        surgeries: null,
      },
      dietary: {
        r24h: [
          {
            mealTime: 'desayuno',
            cereals: 'pan',
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
          },
        ],
        foodPreferenceGroups: [
          {
            group: 'lacteos',
            frequentConsumption: ['leche'],
            occasionalConsumption: [],
            rareConsumption: [],
            avoidedFoods: [],
          },
        ],
        sportsStrategy: {
          supplement: ['creatina', 'whey'],
          hydration: ['agua'],
          preActivityMeal: 'plátano',
          duringActivityMeal: null,
          postActivityMeal: 'batido',
        },
      },
      lifestyle: {
        alcohol: 'ocasional',
        tobacco: 'no',
        physicalActivityLevel: 'moderado',
        sport: ['running'],
        sportSession: [
          {
            description: 'trote suave',
            discipline: 'running',
            duration: 40,
            intensity: 'moderada',
            eventType: 'entrenamiento de resistencia',
            days: 'lunes, miércoles',
            schedule: 'mañana',
          },
        ],
      },
    };

    const result = mapAnamnesisDtoToDetails(anamnesis)!;

    expect(result.goals).toEqual({
      mainGoal: 'bajar de peso',
      secondaryGoal: ['tonificar'],
    });
    expect(result.clinical).toMatchObject({
      pathology: ['hipotiroidismo'],
      allergy: ['ninguna'],
      intolerance: ['lactosa'],
      medication: ['ninguno'],
      gastrointestinal: [],
      surgery: [],
      bowelMovement: 'normales',
    });
    expect(result.dietary?.r24hMeals).toHaveLength(1);
    expect(result.dietary?.r24hMeals?.[0].mealTime).toBe('desayuno');
    expect(result.dietary?.foodPreferenceGroups?.[0].group).toBe('lacteos');
    expect(result.lifestyle?.sport).toEqual(['running']);
    expect(result.lifestyle?.sportsSessions?.[0].eventType).toBe('TRAINING');
    // sportsStrategy vive en "anamnesis.dietary" (DTO) pero se mapea a "lifestyle.sportsStrategies" (entidad)
    expect(result.lifestyle?.sportsStrategies).toEqual([
      {
        supplement: 'creatina, whey',
        hydration: 'agua',
        preActivityMeal: 'plátano',
        duringActivityMeal: null,
        postActivityMeal: 'batido',
      },
    ]);
  });

  it('cada sub-objeto (goals/clinical/dietary/lifestyle) es undefined si viene null', () => {
    const anamnesis: AnamnesisDto = {
      goals: null,
      clinical: null,
      dietary: null,
      lifestyle: null,
    };
    const result = mapAnamnesisDtoToDetails(anamnesis)!;
    expect(result.goals).toBeUndefined();
    expect(result.clinical).toBeUndefined();
    expect(result.dietary).toBeUndefined();
    expect(result.lifestyle).toBeUndefined();
  });
});

describe('mapMeasurementsDtoToDetails', () => {
  const measuredAt = new Date('2026-09-26T12:00:00.000Z');

  it('devuelve null si measurements es null', () => {
    expect(mapMeasurementsDtoToDetails(null, measuredAt)).toBeNull();
  });

  it('mapea weight/height a basicMeasurements, somatotype a description, y calcula el IMC de una medición BASIC', () => {
    const measurements: MeasurementsDto = {
      weight: 70,
      height: 175,
      somatotype: 'MESO',
    };
    const result = mapMeasurementsDtoToDetails(measurements, measuredAt)!;

    expect(result.measuredAt).toBe(measuredAt);
    expect(result.measurementNumber).toBe(1);
    expect(result.level).toBe('BASIC');
    expect(result.description).toBe('MESO');
    expect(result.basicMeasurements).toEqual({
      weight: 70,
      height: 175,
      sittingHeight: null,
      armSpan: null,
    });
    expect(result.measurementResults).toEqual({
      bmi: 22.86,
      bmiClassification: 'NORMAL_WEIGHT',
    });
  });

  it('omite basicMeasurements y measurementResults si falta weight o height', () => {
    const result = mapMeasurementsDtoToDetails(
      { weight: null, height: 175, somatotype: null },
      measuredAt,
    )!;
    expect(result.basicMeasurements).toBeUndefined();
    expect(result.measurementResults).toBeUndefined();
    expect(result.description).toBeNull();
  });
});
