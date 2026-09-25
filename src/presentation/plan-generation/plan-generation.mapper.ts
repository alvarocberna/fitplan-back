// Mapea el NutritionPlanDto (el plan que genera processPlan y se serializa en Order.planJson) hacia
// el NutritionalPlan principal que PlanRepository.upsertPlanWithMainNutritionalPlanByOrderId crea
// dentro del Plan de la orden: la representación normalizada del plan en el schema Postgres (ver
// NutritionalPlanEntity). Solo cubre los campos propios de NutritionalPlan; las tablas hijas
// (PlanMealTime, PlanSupplement, PlanSportsRecommendation) no se pueblan todavía.

import { NutritionPlanDto } from '../../domain/dtos/nutrition-plan.dto';
import { CreateNutritionalPlanDto } from '../../domain/dtos/clinical-domain/nutritional-plan/create-nutritional-plan.dto';

export function mapPlanToNutritionalPlanDto(
  plan: NutritionPlanDto,
  planName: string | null,
  startDate: Date = new Date(),
): Omit<CreateNutritionalPlanDto, 'planId'> {
  const { prescription, planIntake } = plan;

  return {
    planName,
    // La generación automática produce un único plan, sin periodización ni fecha de término.
    period: null,
    mainPlan: true,
    startDate,
    endDate: null,
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
  };
}
