// Mapea el NutritionPlanDto (el plan que genera processPlan y se serializa en Order.planJson) hacia
// el árbol NutritionalPlan principal + tablas hijas (PlanMealTime y sus notas, PlanSupplement y sus
// notas, PlanSportsRecommendation) que PlanRepository.upsertPlanWithMainNutritionalPlanByOrderId crea
// dentro del Plan de la orden: la representación normalizada del plan en el schema Postgres.

import { NutritionPlanDto } from '../../../domain/dtos/nutrition-plan.dto';
import { NutritionalPlanTreeDto } from '../../../domain/dtos/clinical-domain/plan/upsert-plan-with-main-nutritional-plan.dto';
import {
  PlanMealTimeNoteType,
  PlanMealTimeSlot,
  PlanSupplementNoteType,
} from '../../../domain/entities/enums';
import { MealTimeType } from '../../../domain/services/alimentos/meal-times.service';
import { NumericMealTimePortions } from '../../../domain/services/alimentos/portion-adequacy.service';

// nutritional_plan.plan_name es NOT NULL: se usa si la orden no trae el nombre de su producto.
const DEFAULT_PLAN_NAME = 'Plan Nutricional Personalizado';

const MEAL_TIME_SLOT: Record<MealTimeType, PlanMealTimeSlot> = {
  desayuno: PlanMealTimeSlot.BREAKFAST,
  almuerzo: PlanMealTimeSlot.LUNCH,
  once: PlanMealTimeSlot.AFTERNOON_TEA,
  cena: PlanMealTimeSlot.DINNER,
  colacion: PlanMealTimeSlot.SNACK,
};

type MealTimeTree = NutritionalPlanTreeDto['mealTimes'][number];
type PortionColumn = Exclude<
  keyof MealTimeTree,
  'time' | 'hour' | 'calorieIntake' | 'proteinIntake' | 'carbohydrateIntake' | 'fatIntake' | 'notes'
>;

// Grupo de alimentos del plan (NumericMealTimePortions / foods) -> columna de plan_meal_time.
const PORTION_COLUMN: Record<keyof NumericMealTimePortions, PortionColumn> = {
  cereals: 'cereal',
  freeConsumptionVegetables: 'freeConsumptionVegetable',
  generalConsumptionVegetables: 'generalConsumptionVegetable',
  fruits: 'fruit',
  highFatProteins: 'highFatProtein',
  lowFatProteins: 'lowFatProtein',
  highFatDairy: 'highFatDairy',
  mediumFatDairy: 'mediumFatDairy',
  lowFatDairy: 'lowFatDairy',
  highProteinDairy: 'highProteinDairy',
  highLipidFoods: 'lipidRich',
  oils: 'oil',
  sugars: 'sugar',
};

// `numericPortions` va alineado por índice con plan.mealTimes: son las porciones exactas que calculó
// el código (NutritionPlanDto solo trae su texto, ej "2 porciones"). `endDate` es el término del
// período proyectado (ver domain/services/projection/projection.service.ts).
export function mapPlanToNutritionalPlanDto(
  plan: NutritionPlanDto,
  planName: string | null,
  numericPortions: NumericMealTimePortions[],
  startDate: Date = new Date(),
  endDate: Date | null = null,
): NutritionalPlanTreeDto {
  const { prescription, planIntake } = plan;

  return {
    planName: planName ?? DEFAULT_PLAN_NAME,
    // La generación automática produce un único plan, sin periodización.
    period: null,
    mainPlan: true,
    startDate,
    endDate,
    goal: prescription.goal,
    dietRegimen: prescription.regimen,
    calorieRequirement: prescription.calories,
    proteinRequirement: prescription.protein,
    carbohydrateRequirement: prescription.carbohydrate,
    lipidRequirement: prescription.fat,
    calorieIntake: planIntake.totalIntake.calories,
    proteinIntake: planIntake.totalIntake.protein,
    carbohydrateIntake: planIntake.totalIntake.carbohydrate,
    lipidIntake: planIntake.totalIntake.fat,
    mealTimes: plan.mealTimes.map((mealTime, index) =>
      mapMealTime(mealTime, numericPortions[index]),
    ),
    supplements: plan.supplements.map((supplement) => ({
      supplement: supplement.supplement,
      requirement: supplement.requirement,
      doseInstructions: supplement.dosageIndication,
      intakeInstructions: supplement.intakeIndication,
      calorieIntake: supplement.intake.calories,
      proteinIntake: supplement.intake.protein,
      carbohydrateIntake: supplement.intake.carbohydrate,
      fatIntake: supplement.intake.fat,
      notes: [
        ...supplement.effects.map((note) => ({ note, type: PlanSupplementNoteType.EFFECT })),
        ...supplement.considerations.map((note) => ({
          note,
          type: PlanSupplementNoteType.CONSIDERATION,
        })),
      ],
    })),
    sportsRecommendations: plan.sportsRecommendations.map((recommendation) => ({
      session: recommendation.session,
      strategy: recommendation.strategy,
      preActivity: recommendation.preActivity,
      duringActivity: recommendation.duringActivity,
      postActivity: recommendation.postActivity,
    })),
  };
}

function mapMealTime(
  mealTime: NutritionPlanDto['mealTimes'][number],
  portions: NumericMealTimePortions | undefined,
): MealTimeTree {
  const time = MEAL_TIME_SLOT[mealTime.description.time as MealTimeType];
  if (!time) {
    throw new Error(`Tiempo de comida desconocido: "${mealTime.description.time}"`);
  }

  // 0 porciones = el grupo no está en este tiempo de comida -> null (columna nullable).
  const portionColumns = Object.fromEntries(
    (Object.keys(PORTION_COLUMN) as (keyof NumericMealTimePortions)[]).map((group) => [
      PORTION_COLUMN[group],
      portions?.[group] ? portions[group] : null,
    ]),
  ) as Pick<MealTimeTree, PortionColumn>;

  const equivalences = Object.entries(mealTime.foods).flatMap(([group, food]) =>
    food?.equivalence
      ? [{ note: `${group}: ${food.equivalence}`, type: PlanMealTimeNoteType.EQUIVALENCE }]
      : [],
  );

  return {
    time,
    hour: mealTime.description.hour,
    calorieIntake: mealTime.intake.calories,
    proteinIntake: mealTime.intake.protein,
    carbohydrateIntake: mealTime.intake.carbohydrate,
    fatIntake: mealTime.intake.fat,
    ...portionColumns,
    notes: [
      ...mealTime.examples.map((note) => ({ note, type: PlanMealTimeNoteType.EXAMPLE })),
      ...mealTime.comments.map((note) => ({ note, type: PlanMealTimeNoteType.COMMENT })),
      ...equivalences,
    ],
  };
}
