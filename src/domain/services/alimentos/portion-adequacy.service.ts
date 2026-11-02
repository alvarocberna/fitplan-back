// PASO 2 y 3 DOC (adecuacion-porciones.md, secciones "2 - Se definen los alimentos (grupos de
// alimentos) de los tiempos de comida", "3 - Adecuación de grupos de alimentos" y "Pasos para generar
// el campo 'intake'"): a partir de los tiempos de comida ya determinados (meal-times.service.ts),
// primero se limpian los alimentos poco saludables reportados por el paciente (paso 2) y luego, tomando
// esa base, se calcula cuántas porciones de cada grupo de alimentos corresponden a cada tiempo de
// comida (campo "foods") y el aporte nutricional resultante de cada tiempo (campo "intake").
//
// Esta lógica reemplaza lo que antes se le pedía calcular a la IA: las reglas del documento son
// completamente determinísticas, por lo que se implementan acá como código para que el resultado
// sea siempre reproducible.
import { Meal } from '../../dtos/consultation.dto';
import { Requirements } from '../formulas/requirements/requirements.service';
import { FOOD_GROUP_PORTIONS, findFoodGroup } from './food-portions';
import {
  MealTimeType,
  isMainMealTime,
  normalizeMealTime,
} from './meal-times.service';

// ---------------------------------------------------------------------------------------------
// PASO 2 - Se definen los alimentos (grupos de alimentos) de los tiempos de comida
// ---------------------------------------------------------------------------------------------

// Mismo shape que Meal, pero con los campos de alimentos convertidos a boolean: true si el
// paciente reportó ese grupo y se conserva como saludable/relevante para ese tiempo de comida,
// null si no fue reportado o si se eliminó por poco saludable / sin aporte real.
export type MealGroups = {
  [K in keyof Meal]: K extends 'mealTime' ? string | null : boolean | null;
};

type FoodField = Exclude<keyof Meal, 'mealTime'>;

const FOOD_FIELDS: FoodField[] = [
  'cereals',
  'freeConsumptionVegetable',
  'generalConsumptionVegetable',
  'fruit',
  'highFatProtein',
  'lowFatProtein',
  'highFatDairy',
  'mediumFatDairy',
  'lowFatDairy',
  'highProteinDairy',
  'highLipid',
  'oil',
  'sugar',
  'alcohol',
];

// Alimentos que se consideran poco saludables o sin aporte real para cada tiempo de comida: se
// eliminan (pasan a null) sin importar lo que haya reportado el paciente.
const FIELDS_REMOVED_BY_MEAL_TIME: Record<MealTimeType, FoodField[]> = {
  desayuno: ['oil', 'sugar'],
  once: ['oil', 'sugar'],
  almuerzo: ['sugar'],
  cena: ['sugar'],
  colacion: ['oil', 'sugar'],
};

// El alcohol nunca forma parte del cálculo de porciones (no existe grupo equivalente en
// FOOD_GROUP_PORTIONS): se elimina siempre, en todos los tiempos de comida.
const FIELDS_ALWAYS_REMOVED: FoodField[] = ['alcohol'];

export function defineFoodGroups(mealTimes: Meal[]): MealGroups[] {
  return mealTimes.map((meal) => {
    const type = normalizeMealTime(meal.mealTime);
    const removed = type ? FIELDS_REMOVED_BY_MEAL_TIME[type] : [];

    const result = { mealTime: meal.mealTime } as MealGroups;
    for (const field of FOOD_FIELDS) {
      const isRemoved =
        FIELDS_ALWAYS_REMOVED.includes(field) || removed.includes(field);
      result[field] = !isRemoved && Boolean(meal[field]) ? true : null;
    }
    return result;
  });
}

// ---------------------------------------------------------------------------------------------
// PASO 3 - Adecuación de grupos de alimentos + intake
// ---------------------------------------------------------------------------------------------

export interface CalculatedMealTimeFoods {
  cereals: string | null;
  freeConsumptionVegetables: string | null;
  generalConsumptionVegetables: string | null;
  fruits: string | null;
  highFatProteins: string | null;
  lowFatProteins: string | null;
  highFatDairy: string | null;
  mediumFatDairy: string | null;
  lowFatDairy: string | null;
  highProteinDairy: string | null;
  highLipidFoods: string | null;
  oils: string | null;
  sugars: string | null;
}

export interface CalculatedIntake {
  calories: number;
  protein: number;
  carbohydrate: number;
  fat: number;
}

// Mismo shape que CalculatedIntake, pero con porcentajes de adecuación (ej 102.3 = 102.3%) en vez
// de valores absolutos. Ver calculateTotalAdequacy.
export interface TotalAdequacy {
  calories: number;
  protein: number;
  carbohydrate: number;
  fat: number;
}

// Mismo shape que CalculatedMealTimeFoods, pero con el número de porciones exacto (float, sin
// redondear a cuartos ni formatear a texto) de cada grupo. "foods" (arriba) es para mostrarle
// el resultado a un humano/a la IA; este campo es para que el código pueda VALIDAR con precisión
// numérica los "components" que la IA reporte al generar los examples (ver plan-generation.service.ts,
// validateGeneratedExamples). 0 si ese grupo no aplica a este tiempo de comida.
export interface NumericMealTimePortions {
  cereals: number;
  freeConsumptionVegetables: number;
  generalConsumptionVegetables: number;
  fruits: number;
  highFatProteins: number;
  lowFatProteins: number;
  highFatDairy: number;
  mediumFatDairy: number;
  lowFatDairy: number;
  highProteinDairy: number;
  highLipidFoods: number;
  oils: number;
  sugars: number;
}

export interface CalculatedMealTime {
  mealTimeType: MealTimeType;
  intake: CalculatedIntake;
  foods: CalculatedMealTimeFoods;
  numericPortions: NumericMealTimePortions;
}

// Objeto devuelto por calculateFoodsAndIntake (ver adecuacion-porciones.md, paso 3): además de
// los tiempos de comida ya con sus porciones e intake, incluye por separado el whey protein que
// haya sido necesario para cerrar el requerimiento de proteína (sección 3.1 del documento). El
// whey protein es un suplemento, no un alimento de un tiempo de comida puntual: por eso NO se
// adjunta al "intake"/"foods" de ningún tiempo (aunque su aporte energético SÍ se descontó al
// calcular cuántas porciones de los demás grupos hacían falta), y se entrega acá aparte para que
// el promp de la IA lo agregue a la sección "supplements" del plan.
export interface PortionAdequacyResult {
  calculatedMealTimes: CalculatedMealTime[];
  supplementIntakeNote: string | null;
  // Aporte nutricional del whey protein de "supplementIntakeNote" ({calories:0,...} si no
  // aplica). Se entrega por separado (no sumado a ningún tiempo) para poder calcular el
  // porcentaje de adecuación TOTAL del plan (tiempos de comida + este suplemento) sin tener que
  // volver a derivar las porciones de whey a partir del string.
  supplementIntake: CalculatedIntake;
}

// Tope de iteraciones de los bucles "ir añadiendo porciones hasta llegar al 100% de adecuación".
// Es una guarda defensiva: con requerimientos reales nunca se acerca a este número, pero evita
// que un dato corrupto (ej. requerimiento negativo o cero) cuelgue el cálculo en un loop infinito.
const MAX_ITERATIONS = 1000;

// 3.1 DOC: el requerimiento corregido de proteína corresponde al 85% del requerimiento calculado
// (el resto se completa con la proteína que aportan los otros grupos de alimentos más adelante).
const CORRECTED_PROTEIN_REQUIREMENT_FACTOR = 0.85;

// Redondea un número de porciones a su representación de texto, ej 1 -> "1 porción",
// 2 -> "2 porciones", 0.5 -> "1/2 porción", 1.5 -> "1 1/2 porciones". Los aceites, al repartirse
// en partes iguales entre los tiempos que los llevan (ver distribución de aceites más abajo),
// pueden quedar en cuartos (ej 0.75 -> "3/4 porción"); por eso se redondea a la fracción de
// cuarto más cercana en vez de solo enteros/medios. null si no hay porciones.
function formatPortions(quantity: number): string | null {
  if (!quantity || quantity <= 0) return null;
  const quarters = Math.round(quantity * 4);
  const whole = Math.floor(quarters / 4);
  const remainderQuarters = quarters % 4;
  const FRACTIONS: Record<number, string> = { 1: '1/4', 2: '1/2', 3: '3/4' };
  const quantityText = [
    whole > 0 ? `${whole}` : null,
    remainderQuarters ? FRACTIONS[remainderQuarters] : null,
  ]
    .filter(Boolean)
    .join(' ');
  const singular = quantity <= 1;
  return `${quantityText} ${singular ? 'porción' : 'porciones'}`;
}

// Reparte "quantity" unidades de a una, en orden cíclico, entre los índices de cada fase, sin
// superar el "capMax" de esa fase para cada índice (el cap es acumulado entre fases: si un índice
// ya tiene 1 porción de una fase anterior y esta fase tiene capMax 2, puede recibir 1 más).
// Determina el comportamiento de distribución de todos los grupos de alimentos del documento
// (validado contra los ejemplos numéricos de adecuacion-porciones.md).
function distributeRoundRobin(
  quantity: number,
  phases: { indices: number[]; capMax: number }[],
  result: number[],
): void {
  let remaining = quantity;
  for (const phase of phases) {
    if (remaining <= 0) break;
    let progress = true;
    while (remaining > 0 && progress) {
      progress = false;
      for (const idx of phase.indices) {
        if (remaining <= 0) break;
        if (result[idx] < phase.capMax) {
          result[idx] += 1;
          remaining -= 1;
          progress = true;
        }
      }
    }
  }
}

export function calculateFoodsAndIntake(
  mealTimes: MealGroups[],
  requirements: Requirements,
): PortionAdequacyResult {
  const n = mealTimes.length;
  const types = mealTimes.map(
    (t) => normalizeMealTime(t.mealTime) ?? 'colacion',
  );
  const mainMealIndices = types
    .map((t, i) => (isMainMealTime(t) ? i : -1))
    .filter((i) => i >= 0);
  const snackIndices = types
    .map((t, i) => (!isMainMealTime(t) ? i : -1))
    .filter((i) => i >= 0);
  const breakfastIdx = types.indexOf('desayuno');
  const lunchIdx = types.indexOf('almuerzo');
  const onceIdx = types.indexOf('once');
  const dinnerIdx = types.indexOf('cena');
  const lunchDinnerSlots = [lunchIdx, dinnerIdx].filter((i) => i >= 0);

  const cerealsGroup = findFoodGroup('Cereales', null);
  const freeVegetablesGroup = findFoodGroup('Verduras', 'Libre consumo');
  const fruitsGroup = findFoodGroup('Frutas', null);
  const lowFatProteinGroup = findFoodGroup('Proteinas', 'Baja en grasa');
  const mediumFatDairyGroup = findFoodGroup('Lácteos', 'Medios en grasas');
  const highProteinDairyGroup = findFoodGroup('Lácteos', 'Alto en proteina');
  const highLipidGroup = findFoodGroup('Ricos en lípidos', null);
  const oilsGroup = findFoodGroup('Aceites y grasas', null);
  const wheyGroup = findFoodGroup('Suplementos', 'proteina');

  // ---------------------------------------------------------------------------------------
  // 3.1 - Adecuación de proteína (conteo total del día; la distribución por tiempo se hace
  // más abajo, después de calcular los cereales, por la excepción de prioridad de lácteos que
  // depende de las porciones de cereal de cada colación).
  // ---------------------------------------------------------------------------------------
  const correctedProteinRequirement =
    requirements.protein * CORRECTED_PROTEIN_REQUIREMENT_FACTOR;
  const proteinPortionsLimit = 2 * mainMealIndices.length;

  let proteinPortions = 0;
  let dairyPortions = 0;
  let dairyIsProtein = false;
  let wheyScoops = 0;
  let patternCounter = 0;

  const totalProteinGrams = () =>
    proteinPortions * lowFatProteinGroup.intakePerPortion.protein +
    dairyPortions *
      (dairyIsProtein ? highProteinDairyGroup : mediumFatDairyGroup)
        .intakePerPortion.protein +
    wheyScoops * wheyGroup.intakePerPortion.protein;

  for (
    let iter = 0;
    iter < MAX_ITERATIONS && totalProteinGrams() < correctedProteinRequirement;
    iter++
  ) {
    patternCounter++;
    if (patternCounter % 4 === 0) {
      // El lácteo "debido" por el patrón se añade igual aunque ya se haya alcanzado el
      // límite: el límite del documento aplica solo a "porciones de proteina", no a lácteos.
      dairyPortions++;
    } else {
      if (proteinPortions >= proteinPortionsLimit) break;
      proteinPortions++;
    }
  }

  if (
    totalProteinGrams() < correctedProteinRequirement &&
    dairyPortions > 0 &&
    !dairyIsProtein
  ) {
    dairyIsProtein = true;
  }
  if (totalProteinGrams() < correctedProteinRequirement) {
    wheyScoops = 0.5;
  }
  if (totalProteinGrams() < correctedProteinRequirement) {
    wheyScoops = 1;
  }
  for (
    let iter = 0;
    iter < MAX_ITERATIONS && totalProteinGrams() < correctedProteinRequirement;
    iter++
  ) {
    patternCounter++;
    if (patternCounter % 4 === 0) dairyPortions++;
    else proteinPortions++;
  }

  // ---------------------------------------------------------------------------------------
  // 3.2 - Adecuación de carbohidrato
  // ---------------------------------------------------------------------------------------
  const usedDairyGroup = dairyIsProtein
    ? highProteinDairyGroup
    : mediumFatDairyGroup;
  const FIXED_FREE_VEGETABLE_PORTIONS = 2;
  const carbsFromProteinAndDairy =
    proteinPortions * lowFatProteinGroup.intakePerPortion.carbohydrate +
    dairyPortions * usedDairyGroup.intakePerPortion.carbohydrate +
    wheyScoops * wheyGroup.intakePerPortion.carbohydrate;
  const carbsFromVegetables =
    lunchDinnerSlots.length *
    FIXED_FREE_VEGETABLE_PORTIONS *
    freeVegetablesGroup.intakePerPortion.carbohydrate;

  const correctedCarbohydrateRequirement =
    requirements.carbohydrate - carbsFromProteinAndDairy;

  let cerealPortions = 0;
  let fruitPortions = 0;
  let totalCarb = carbsFromVegetables;
  for (
    let iter = 0;
    iter < MAX_ITERATIONS && totalCarb < correctedCarbohydrateRequirement;
    iter++
  ) {
    cerealPortions++;
    totalCarb += cerealsGroup.intakePerPortion.carbohydrate;
    if (cerealPortions % 3 === 0) {
      fruitPortions++;
      totalCarb += fruitsGroup.intakePerPortion.carbohydrate;
    }
  }

  // ---------------------------------------------------------------------------------------
  // 3.3 - Adecuación de lípidos. Orden: 1° rico en lípidos, 2° rico en lípidos, 3° 1/2 porción
  // de aceite, y así sucesivamente (por cada 2 porciones de rico en lípidos, 1/2 de aceite).
  // ---------------------------------------------------------------------------------------
  const fatFromOtherGroups =
    proteinPortions * lowFatProteinGroup.intakePerPortion.fat +
    dairyPortions * usedDairyGroup.intakePerPortion.fat +
    wheyScoops * wheyGroup.intakePerPortion.fat +
    cerealPortions * cerealsGroup.intakePerPortion.fat +
    fruitPortions * fruitsGroup.intakePerPortion.fat +
    lunchDinnerSlots.length *
      FIXED_FREE_VEGETABLE_PORTIONS *
      freeVegetablesGroup.intakePerPortion.fat;

  const correctedFatRequirement = requirements.fat - fatFromOtherGroups;

  let highLipidPortions = 0;
  let oilPortions = 0;
  let totalFat = 0;
  let fatCounter = 0;
  for (
    let iter = 0;
    iter < MAX_ITERATIONS && totalFat < correctedFatRequirement;
    iter++
  ) {
    fatCounter++;
    if (fatCounter % 3 === 0) {
      oilPortions += 0.5;
      totalFat += oilsGroup.intakePerPortion.fat * 0.5;
    } else {
      highLipidPortions += 1;
      totalFat += highLipidGroup.intakePerPortion.fat;
    }
  }

  // ---------------------------------------------------------------------------------------
  // 3° - Distribución de las porciones calculadas en los tiempos de comida.
  // ---------------------------------------------------------------------------------------
  const proteinByMealTime = new Array(n).fill(0);
  distributeRoundRobin(
    proteinPortions,
    [
      { indices: mainMealIndices, capMax: 2 },
      { indices: snackIndices.slice(0, 1), capMax: 2 },
      { indices: mainMealIndices, capMax: Infinity },
    ],
    proteinByMealTime,
  );

  const cerealsByMealTime = new Array(n).fill(0);
  distributeRoundRobin(
    cerealPortions,
    [
      { indices: mainMealIndices, capMax: 2 },
      { indices: snackIndices, capMax: 1 },
      { indices: snackIndices, capMax: 2 },
      { indices: mainMealIndices, capMax: Infinity },
    ],
    cerealsByMealTime,
  );

  const fruitPriority = [
    ...snackIndices,
    lunchIdx,
    breakfastIdx,
    onceIdx,
    dinnerIdx,
  ].filter((i) => i >= 0);
  const fruitByMealTime = new Array(n).fill(0);
  distributeRoundRobin(
    fruitPortions,
    [
      { indices: fruitPriority, capMax: 1 },
      { indices: fruitPriority, capMax: 2 },
      { indices: fruitPriority, capMax: Infinity },
    ],
    fruitByMealTime,
  );

  // Lácteos: solo van en Desayuno, Once y Colaciones (nunca Almuerzo/Cena). Si una colación
  // quedó con exactamente 1 porción de cereales, pasa a tener primera prioridad.
  const snacksWithOneCereal = snackIndices.filter(
    (i) => cerealsByMealTime[i] === 1,
  );
  const snacksWithoutException = snackIndices.filter(
    (i) => cerealsByMealTime[i] !== 1,
  );
  const dairyPriority = [
    ...snacksWithOneCereal,
    breakfastIdx,
    onceIdx,
    ...snacksWithoutException,
  ].filter((i) => i >= 0);
  const dairyByMealTime = new Array(n).fill(0);
  distributeRoundRobin(
    dairyPortions,
    [
      { indices: dairyPriority, capMax: 1 },
      { indices: dairyPriority, capMax: 2 },
      { indices: dairyPriority, capMax: Infinity },
    ],
    dairyByMealTime,
  );

  const highLipidPriority = [breakfastIdx, ...snackIndices, onceIdx].filter(
    (i) => i >= 0,
  );
  const highLipidByMealTime = new Array(n).fill(0);
  distributeRoundRobin(
    highLipidPortions,
    [
      { indices: highLipidPriority, capMax: 1 },
      { indices: highLipidPriority, capMax: Infinity },
    ],
    highLipidByMealTime,
  );

  const oilByMealTime = new Array(n).fill(0);
  if (lunchDinnerSlots.length > 0 && oilPortions > 0) {
    const perSlot = oilPortions / lunchDinnerSlots.length;
    lunchDinnerSlots.forEach((i) => (oilByMealTime[i] = perSlot));
  }

  // Whey protein (si aplica): es un suplemento, no un alimento de un tiempo de comida puntual,
  // por lo que NO se adjunta al "intake"/"foods" de ningún tiempo. Su aporte energético sí
  // se descontó más arriba al calcular cuántas porciones de los demás grupos hacían falta (ver
  // carbsFromProteinAndDairy, fatFromOtherGroups y totalDailyCalories). Se entrega aparte en
  // "supplementIntakeNote" para que la IA lo agregue a la sección "supplements" del plan.
  const supplementIntakeNote: string | null =
    wheyScoops > 0
      ? `whey protein ${wheyScoops === 0.5 ? '1/2 scoop' : '1 scoop'}`
      : null;
  const supplementIntake: CalculatedIntake = {
    calories: wheyScoops * wheyGroup.intakePerPortion.calories,
    protein: wheyScoops * wheyGroup.intakePerPortion.protein,
    carbohydrate: wheyScoops * wheyGroup.intakePerPortion.carbohydrate,
    fat: wheyScoops * wheyGroup.intakePerPortion.fat,
  };

  // ---------------------------------------------------------------------------------------
  // 3.4 - Evaluar y corregir adecuación y distribución.
  //
  // Adecuación: el cálculo mecánico de 3.1-3.3 avanza macronutriente por macronutriente
  // ("hasta llegar al 100%/90-110% de CADA macro por separado"), pero las calorías totales del
  // día son la suma de los cuatro (proteína, lácteos, cereales, frutas, ricos en lípidos,
  // aceites), por lo que el resultado mecánico puede terminar por sobre el objetivo PRINCIPAL
  // del documento (calorías 95-105%) aunque cada macro por separado haya cerrado en su propio
  // rango. Para corregirlo, si las calorías totales exceden el 105% se retiran porciones (de a
  // una, recalculando cada vez) en orden de menor prioridad nutricional -aceites, ricos en
  // lípidos, frutas, cereales-, sin tocar proteína/lácteos (su objetivo de adecuación ya se
  // cumplió y es el más protegido); si quedan por debajo del 95% se agregan porciones de
  // cereales (el macro más flexible) al tiempo principal que tenga menos. No hay una regla
  // explícita en el documento sobre qué grupo específico ajustar acá: se prioriza así porque
  // son los últimos grupos en calcularse y los de menor relevancia nutricional relativa.
  // ---------------------------------------------------------------------------------------
  const caloriesFor = (
    portions: number,
    group: { intakePerPortion: { calories: number } },
  ) => portions * group.intakePerPortion.calories;

  const totalDailyCalories = (): number => {
    let total =
      lunchDinnerSlots.length *
        FIXED_FREE_VEGETABLE_PORTIONS *
        freeVegetablesGroup.intakePerPortion.calories +
      wheyScoops * wheyGroup.intakePerPortion.calories;
    for (let i = 0; i < n; i++) {
      total +=
        caloriesFor(cerealsByMealTime[i], cerealsGroup) +
        caloriesFor(fruitByMealTime[i], fruitsGroup) +
        caloriesFor(proteinByMealTime[i], lowFatProteinGroup) +
        caloriesFor(dairyByMealTime[i], usedDairyGroup) +
        caloriesFor(highLipidByMealTime[i], highLipidGroup) +
        caloriesFor(oilByMealTime[i], oilsGroup);
    }
    return total;
  };

  // Se prioriza recortar primero el grupo que más aporta a los macros que ya están por sobre su
  // objetivo (carbohidrato y proteína suelen sobrepasarse primero, por el arrastre de cereales y
  // proteína/lácteos calculados en pasos previos), dejando los grupos que sostienen los lípidos
  // (ricos en lípidos, aceites) para el final: el lípido es el macro que más cuesta recuperar una
  // vez recortado, al tener el aporte por porción más bajo en relación al resto.
  const resourcesToTrim: { arr: number[]; step: number }[] = [
    { arr: cerealsByMealTime, step: 1 },
    { arr: fruitByMealTime, step: 1 },
    { arr: highLipidByMealTime, step: 1 },
    { arr: oilByMealTime, step: 0.5 },
  ];
  const removeOneUnit = (): boolean => {
    for (const resource of resourcesToTrim) {
      let chosenIdx = -1;
      for (let i = 0; i < n; i++) {
        if (
          resource.arr[i] >= resource.step &&
          (chosenIdx === -1 || resource.arr[i] > resource.arr[chosenIdx])
        ) {
          chosenIdx = i;
        }
      }
      if (chosenIdx >= 0) {
        resource.arr[chosenIdx] -= resource.step;
        return true;
      }
    }
    return false;
  };

  const CORRECTION_LIMIT = 500;
  for (
    let iter = 0;
    iter < CORRECTION_LIMIT &&
    totalDailyCalories() > requirements.calories * 1.05 &&
    removeOneUnit();
    iter++
  );

  for (
    let iter = 0;
    iter < CORRECTION_LIMIT &&
    totalDailyCalories() < requirements.calories * 0.95 &&
    mainMealIndices.length > 0;
    iter++
  ) {
    const minCerealIdx = mainMealIndices.reduce(
      (best, i) => (cerealsByMealTime[i] < cerealsByMealTime[best] ? i : best),
      mainMealIndices[0],
    );
    cerealsByMealTime[minCerealIdx] += 1;
  }

  // Distribución: todo tiempo de comida definido debe llevar algo. Si alguno quedó sin ningún
  // alimento, se desplaza 1 porción desde Desayuno u Once (1° ricos en lípidos, 2° fruta,
  // 3° lácteos).
  const hasSomething = (i: number): boolean =>
    cerealsByMealTime[i] > 0 ||
    fruitByMealTime[i] > 0 ||
    proteinByMealTime[i] > 0 ||
    dairyByMealTime[i] > 0 ||
    highLipidByMealTime[i] > 0 ||
    oilByMealTime[i] > 0 ||
    lunchDinnerSlots.includes(i);

  for (let emptyIdx = 0; emptyIdx < n; emptyIdx++) {
    if (hasSomething(emptyIdx)) continue;
    for (const sourceIdx of [breakfastIdx, onceIdx].filter(
      (idx) => idx >= 0 && idx !== emptyIdx,
    )) {
      if (highLipidByMealTime[sourceIdx] > 0) {
        highLipidByMealTime[sourceIdx] -= 1;
        highLipidByMealTime[emptyIdx] += 1;
        break;
      }
      if (fruitByMealTime[sourceIdx] > 0) {
        fruitByMealTime[sourceIdx] -= 1;
        fruitByMealTime[emptyIdx] += 1;
        break;
      }
      if (dairyByMealTime[sourceIdx] > 0) {
        dairyByMealTime[sourceIdx] -= 1;
        dairyByMealTime[emptyIdx] += 1;
        break;
      }
    }
  }

  // ---------------------------------------------------------------------------------------
  // Ensamblado final: "foods" + "intake" (sección "Pasos para generar el campo 'intake'")
  // ---------------------------------------------------------------------------------------
  const calculatedMealTimes: CalculatedMealTime[] = mealTimes.map((_, i) => {
    const foods: CalculatedMealTimeFoods = {
      cereals: formatPortions(cerealsByMealTime[i]),
      freeConsumptionVegetables: lunchDinnerSlots.includes(i)
        ? formatPortions(FIXED_FREE_VEGETABLE_PORTIONS)
        : null,
      generalConsumptionVegetables: null,
      fruits: formatPortions(fruitByMealTime[i]),
      highFatProteins: null,
      lowFatProteins: formatPortions(proteinByMealTime[i]),
      highFatDairy: null,
      mediumFatDairy: !dairyIsProtein
        ? formatPortions(dairyByMealTime[i])
        : null,
      lowFatDairy: null,
      highProteinDairy: dairyIsProtein
        ? formatPortions(dairyByMealTime[i])
        : null,
      highLipidFoods: formatPortions(highLipidByMealTime[i]),
      oils: formatPortions(oilByMealTime[i]),
      sugars: null,
    };

    const numericPortions: NumericMealTimePortions = {
      cereals: cerealsByMealTime[i],
      freeConsumptionVegetables: lunchDinnerSlots.includes(i)
        ? FIXED_FREE_VEGETABLE_PORTIONS
        : 0,
      generalConsumptionVegetables: 0,
      fruits: fruitByMealTime[i],
      highFatProteins: 0,
      lowFatProteins: proteinByMealTime[i],
      highFatDairy: 0,
      mediumFatDairy: !dairyIsProtein ? dairyByMealTime[i] : 0,
      lowFatDairy: 0,
      highProteinDairy: dairyIsProtein ? dairyByMealTime[i] : 0,
      highLipidFoods: highLipidByMealTime[i],
      oils: oilByMealTime[i],
      sugars: 0,
    };

    let intake: CalculatedIntake = {
      calories: 0,
      protein: 0,
      carbohydrate: 0,
      fat: 0,
    };
    const addPortions = (
      portions: number,
      group: (typeof FOOD_GROUP_PORTIONS)[number],
    ) => {
      if (!portions) return;
      intake = {
        calories: intake.calories + portions * group.intakePerPortion.calories,
        protein: intake.protein + portions * group.intakePerPortion.protein,
        carbohydrate:
          intake.carbohydrate + portions * group.intakePerPortion.carbohydrate,
        fat: intake.fat + portions * group.intakePerPortion.fat,
      };
    };
    addPortions(cerealsByMealTime[i], cerealsGroup);
    addPortions(
      lunchDinnerSlots.includes(i) ? FIXED_FREE_VEGETABLE_PORTIONS : 0,
      freeVegetablesGroup,
    );
    addPortions(fruitByMealTime[i], fruitsGroup);
    addPortions(proteinByMealTime[i], lowFatProteinGroup);
    addPortions(dairyByMealTime[i], usedDairyGroup);
    addPortions(highLipidByMealTime[i], highLipidGroup);
    addPortions(oilByMealTime[i], oilsGroup);

    return {
      mealTimeType: types[i],
      intake,
      foods,
      numericPortions,
    };
  });

  return { calculatedMealTimes, supplementIntakeNote, supplementIntake };
}

// Aporte nutricional TOTAL (valores absolutos) del plan: suma el aporte de todos los tiempos de
// comida más el aporte del suplemento de whey protein (si aplica) -NO incluye
// sportsRecommendations ni otros suplementos (creatina, cafeina, nitrato, bicarbonato)-. Se
// expone como campo "planIntake.totalIntake" del NutritionPlanDto (ver plan-generation.service.ts).
export function calculateTotalPlanIntake(
  adequacy: PortionAdequacyResult,
): CalculatedIntake {
  return adequacy.calculatedMealTimes.reduce(
    (acc, t) => ({
      calories: acc.calories + t.intake.calories,
      protein: acc.protein + t.intake.protein,
      carbohydrate: acc.carbohydrate + t.intake.carbohydrate,
      fat: acc.fat + t.intake.fat,
    }),
    { ...adequacy.supplementIntake },
  );
}

// Porcentaje de adecuación de "totalIntake" (ver calculateTotalPlanIntake) en relación a los
// requerimientos calculados, por cada macronutriente. Se expone como campo
// "planIntake.adequacy" del NutritionPlanDto.
export function calculateTotalAdequacy(
  totalIntake: CalculatedIntake,
  requirements: Requirements,
): TotalAdequacy {
  const percentage = (intake: number, required: number) =>
    Math.round((intake / required) * 1000) / 10;

  return {
    calories: percentage(totalIntake.calories, requirements.calories),
    protein: percentage(totalIntake.protein, requirements.protein),
    carbohydrate: percentage(
      totalIntake.carbohydrate,
      requirements.carbohydrate,
    ),
    fat: percentage(totalIntake.fat, requirements.fat),
  };
}
