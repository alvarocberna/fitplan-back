import type {
  PlanMealTimeSlot,
  PlanPeriod,
  ProductType,
} from '../../../domain/entities/enums';

// Ingesta real del plan (nunca los requerimientos): lo que se muestra en la fila de la lista y en
// el resumen del detalle.
export interface MyPlanSummaryInfoDto {
  goal: string | null;
  dietRegimen: string | null;
  calorieIntake: number | null;
  proteinIntake: number | null;
  carbohydrateIntake: number | null;
  lipidIntake: number | null;
}

// Ítem de GET /me/plans (CU-PLN-04): una orden pagada, lista y con PDF del usuario del token.
export interface MyPlanSummaryDto {
  orderId: string;
  type: ProductType;
  // GENERATED: nutritional_plan.plan_name (o product.name si el plan no tiene NutritionalPlan);
  // PREDEFINED: product.name.
  name: string;
  purchasedAt: string; // ISO (payment_date, o creation_date si no la hay)
  // URL firmada (corta duración) de descarga (attachment) del PDF.
  pdfUrl: string;
  // URL firmada de la miniatura WebP de la página 1; null si la orden no tiene miniatura.
  thumbnailUrl: string | null;
  // null si no hay datos (plan generado sin NutritionalPlan, o producto estándar sin resumen cargado).
  summary: MyPlanSummaryInfoDto | null;
}

export interface MacrosDto {
  calories: number;
  protein: number;
  carbohydrate: number;
  // En plan_meal_time/plan_supplement la columna se llama fat_intake; en nutritional_plan,
  // lipid_intake. Acá se unifica como `fat`.
  fat: number;
}

// Nombre de columna de plan_meal_time -> porciones de intercambio de ese grupo de alimentos.
export type MealTimePortionGroup =
  | 'cereal'
  | 'freeConsumptionVegetable'
  | 'generalConsumptionVegetable'
  | 'fruit'
  | 'highFatProtein'
  | 'lowFatProtein'
  | 'highFatDairy'
  | 'mediumFatDairy'
  | 'lowFatDairy'
  | 'highProteinDairy'
  | 'lipidRich'
  | 'oil'
  | 'sugar';

export interface MyPlanMealTimeDto {
  time: PlanMealTimeSlot;
  hour: string | null;
  intake: MacrosDto;
  // Solo los grupos presentes en el tiempo de comida (porciones > 0).
  portions: Partial<Record<MealTimePortionGroup, number>>;
  examples: string[];
  comments: string[];
  // "<grupo>: <alimentos equivalentes>"
  equivalences: string[];
}

export interface MyPlanSupplementDto {
  supplement: string;
  requirement: number;
  doseInstructions: string | null;
  intakeInstructions: string | null;
  intake: MacrosDto;
  effects: string[];
  considerations: string[];
}

export interface MyPlanSportsRecommendationDto {
  session: string | null;
  strategy: string | null;
  preActivity: string | null;
  duringActivity: string | null;
  postActivity: string | null;
}

export interface MyGeneratedPlanDetailDto {
  consultationId: string | null;
  planName: string;
  period: PlanPeriod | null;
  startDate: string | null; // ISO
  endDate: string | null; // ISO
  goal: string;
  dietRegimen: string;
  requirements: MacrosDto;
  intake: MacrosDto;
  mealTimes: MyPlanMealTimeDto[];
  supplements: MyPlanSupplementDto[];
  sportsRecommendations: MyPlanSportsRecommendationDto[];
}

export interface MyPredefinedPlanDetailDto {
  description: string;
  summary: MyPlanSummaryInfoDto | null;
}

// Respuesta de GET /me/plans/:orderId (CU-PLN-05). Trae `generated` o `predefined` según `type`
// (el otro va en null). `generated` es null si la orden no tiene ni NutritionalPlan ni planJson.
export interface MyPlanDetailDto extends Omit<MyPlanSummaryDto, 'summary'> {
  generated: MyGeneratedPlanDetailDto | null;
  predefined: MyPredefinedPlanDetailDto | null;
}
