// PASO 1 DOC (adecuacion-porciones.md, sección "1 - Se definen los tiempos de comida")
// Determina, de forma determinística, los tiempos de comida finales del plan a partir del r24h que el
// paciente reportó, completando (con entradas vacías) los tiempos que falten según el objetivo. El
// contenido reportado por el paciente en los tiempos ya existentes se preserva tal cual: este paso solo
// decide CUÁNTOS y CUÁLES tiempos de comida habrá y en qué orden, no qué alimentos llevan (eso lo decide
// el paso 2, ver defineFoodGroups en portion-adequacy.service.ts).

import { Meal } from '../../dtos/consultation.dto';

export type MealTimeType =
  | 'desayuno'
  | 'almuerzo'
  | 'once'
  | 'cena'
  | 'colacion';

// Etiqueta con la que se escribe cada tiempo en el campo "mealTime" del objeto devuelto.
const MEAL_TIME_LABEL: Record<MealTimeType, string> = {
  desayuno: 'desayuno',
  almuerzo: 'almuerzo',
  once: 'once',
  cena: 'cena',
  colacion: 'colación',
};

// Orden canónico de los tiempos principales: se usa tanto para completar los que falten (se
// añade "el primero de la lista que falta") como para ordenar el resultado final.
const MAIN_MEAL_ORDER: MealTimeType[] = [
  'desayuno',
  'almuerzo',
  'once',
  'cena',
];

// Se normaliza el valor de 'mealTime'
export function normalizeMealTime(
  raw: string | null | undefined,
): MealTimeType | null {
  if (!raw) return null;
  const t = raw
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
  if (t.includes('desayuno')) return 'desayuno';
  if (t.includes('almuerzo')) return 'almuerzo';
  if (t.includes('once')) return 'once';
  if (t.includes('cena')) return 'cena';
  if (t.includes('colacion')) return 'colacion';
  return null;
}

export function isMainMealTime(type: MealTimeType): boolean {
  return type !== 'colacion';
}

function emptyMeal(type: MealTimeType): Meal {
  return {
    mealTime: MEAL_TIME_LABEL[type],
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
  };
}

// Elige en qué "hueco" (gap) entre tiempos principales consecutivos va cada colación a agregar.
// El objeto CompleteConsultationDto no registra la hora de los tiempos de comida (Meal no tiene
// campo "hora"), por lo que no es posible aplicar la regla de "la ventana de tiempo superior"
// del documento. En su lugar se usa como default el hueco medio entre principales, que es el
// resultado que da el propio ejemplo del documento (Desayuno 8am, Almuerzo 1pm, Once 8pm ->
// colación entre Almuerzo y Once, que es el hueco medio de una estructura de 3 principales).
function chooseSnackSlots(gaps: number, quantity: number): number[] {
  if (gaps <= 0 || quantity <= 0)
    return new Array(Math.max(0, quantity)).fill(0);
  if (quantity === 1) return [Math.floor(gaps / 2)];
  // 2 o más colaciones: se reparten en huecos sucesivos empezando por el primero (regla
  // explícita para 5 tiempos: "una colación entre el 1er y 2do tiempo principal, y otra entre
  // el 2do y 3er tiempo principal").
  return Array.from({ length: quantity }, (_, i) => i % gaps);
}

// Devuelve la lista final de tiempos de comida (mismo shape que el r24h de entrada) que tendrá el
// plan: los tiempos reportados por el paciente se preservan tal cual (mismos alimentos reportados),
// y los tiempos que se deban agregar para completar la estructura se insertan como entradas vacías.
export function determineMealTimes(r24h: Meal[] | null, goal: string): Meal[] {
  const rows = (r24h ?? [])
    .map((c) => ({ type: normalizeMealTime(c.mealTime), original: c }))
    .filter(
      (f): f is { type: MealTimeType; original: Meal } => f.type !== null,
    );

  let mainMeals = MAIN_MEAL_ORDER.filter((p) => rows.some((f) => f.type === p));
  const reportedSnacks = rows
    .filter((f) => f.type === 'colacion')
    .map((f) => f.original);
  const initialTotal = mainMeals.length + reportedSnacks.length;

  const goalRequiresVolume = goal === 'volumen';
  const targetTotal = goalRequiresVolume ? 5 : 4;

  let snackCount = reportedSnacks.length;

  if (initialTotal <= 3) {
    // 1, 2 o 3 tiempos: se completa a 3 principales + 1 (definir/mantener) o 2 (volumen) colaciones.
    for (const p of MAIN_MEAL_ORDER) {
      if (mainMeals.length >= 3) break;
      if (!mainMeals.includes(p)) mainMeals = [...mainMeals, p];
    }
    mainMeals = MAIN_MEAL_ORDER.filter((p) => mainMeals.includes(p));
    snackCount = Math.max(snackCount, targetTotal - 3);
  } else if (initialTotal === 4 && goalRequiresVolume) {
    // 4 tiempos: solo se agrega un 5to tiempo (colación) si el objetivo es volumen.
    snackCount = snackCount + 1;
  }
  // 4 tiempos sin objetivo volumen, o 5+ tiempos: se usan tal cual, solo se ordenan
  // canónicamente los principales y se posicionan las colaciones con el default.

  const gaps = mainMeals.length - 1;
  const snackSlots = chooseSnackSlots(gaps, snackCount);

  const result: Meal[] = [];
  let snackPtr = 0;
  mainMeals.forEach((type, i) => {
    const original = rows.find((f) => f.type === type)?.original;
    result.push(
      original
        ? { ...original, mealTime: MEAL_TIME_LABEL[type] }
        : emptyMeal(type),
    );

    const snacksInThisSlot = snackSlots.filter((h) => h === i).length;
    for (let c = 0; c < snacksInThisSlot; c++) {
      const originalSnack = reportedSnacks[snackPtr];
      snackPtr++;
      result.push(
        originalSnack
          ? { ...originalSnack, mealTime: MEAL_TIME_LABEL.colacion }
          : emptyMeal('colacion'),
      );
    }
  });
  return result;
}
