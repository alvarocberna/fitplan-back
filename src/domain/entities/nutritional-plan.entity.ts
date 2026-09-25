// Mapea NutritionalPlan y sus hijos de prisma/schema.prisma (sección CLINICAL DOMAIN).
// No confundir con NutritionPlanDto (domain/dtos/nutrition-plan.dto.ts): ese es el JSON que
// genera la IA y se persiste en el `orden` legacy (tabla SQLite `orden`, columna `plan_json`);
// esta entidad es la representación normalizada en el nuevo schema Postgres.

import type { PlanEntity } from './plan.entity';

export type PlanMealTimeSlot =
  | 'BREAKFAST'
  | 'LUNCH'
  | 'AFTERNOON_TEA'
  | 'DINNER'
  | 'SNACK';
export type PlanMealTimeNoteType = 'EXAMPLE' | 'COMMENT';
export type PlanSupplementNoteType = 'EFFECT' | 'CONSIDERATION';

export interface NutritionalPlanEntity {
  id: string;

  // Plan (consulta + orden) al que pertenece; un Plan puede agrupar varios NutritionalPlan.
  planId: string;
  plan?: PlanEntity;

  planName: string | null;
  period: string | null; // EVENTO | MICROCICLO | MESOCICLO | MACROCICLO
  // Plan principal dentro de su Plan (hoy siempre true: la generación crea uno solo).
  mainPlan: boolean;
  startDate: Date | null;
  endDate: Date | null;

  goal: string | null;
  dietRegimen: string | null;

  calorieRequirement: number;
  proteinRequirement: number;
  carbohydrateRequirement: number;
  lipidRequirement: number;

  calorieIntake: number;
  proteinIntake: number;
  carbohydrateIntake: number;
  lipidIntake: number;

  mealTimes?: PlanMealTimeEntity[];
  supplement?: PlanSupplementEntity | null;
  sportsRecommendations?: PlanSportsRecommendationEntity[];
}

// nutritional_plan puede tener múltiples tiempos de comida.
export interface PlanMealTimeEntity {
  id: string;

  planId: string;
  nutritionalPlan?: NutritionalPlanEntity;

  time: PlanMealTimeSlot | null;
  hour: string | null;

  calorieIntake: number;
  proteinIntake: number;
  carbohydrateIntake: number;
  fatIntake: number;

  cereal: number | null;
  freeConsumptionVegetable: number | null;
  generalConsumptionVegetable: number | null;
  fruit: number | null;
  highFatProtein: number | null;
  lowFatProtein: number | null;
  highFatDairy: number | null;
  mediumFatDairy: number | null;
  lowFatDairy: number | null;
  highProteinDairy: number | null;
  lipidRich: number | null;
  oil: number | null;
  sugar: number | null;

  notes?: PlanMealTimeNoteEntity[];
}

// plan_meal_time puede tener múltiples ejemplos y comentarios.
export interface PlanMealTimeNoteEntity {
  id: string;

  planMealTimeId: string;
  planMealTime?: PlanMealTimeEntity;

  note: string;
  type: PlanMealTimeNoteType;
}

// nutritional_plan tiene a lo más un suplemento asociado (objeto, no arreglo).
export interface PlanSupplementEntity {
  id: string;

  planId: string;
  nutritionalPlan?: NutritionalPlanEntity;

  supplement: string;
  requirement: number | null;
  doseInstructions: string | null;
  intakeInstructions: string | null;

  calorieIntake: number;
  proteinIntake: number;
  carbohydrateIntake: number;
  fatIntake: number;

  notes?: PlanSupplementNoteEntity[];
}

// plan_supplement puede tener múltiples efectos y consideraciones.
export interface PlanSupplementNoteEntity {
  id: string;

  planSupplementId: string;
  planSupplement?: PlanSupplementEntity;

  note: string;
  type: PlanSupplementNoteType;
}

// nutritional_plan puede tener múltiples recomendaciones deportivas.
export interface PlanSportsRecommendationEntity {
  id: string;

  planId: string;
  nutritionalPlan?: NutritionalPlanEntity;

  session: string | null;
  strategy: string | null;
  preActivity: string | null;
  duringActivity: string | null;
  postActivity: string | null;
}
