// Mapea el NutritionPlanDto (el plan que genera processPlan y se serializa en Order.planJson) hacia
// el input de NutritionalPlanRepository.upsertNutritionalPlanByOrderId: la representación normalizada
// del plan en el schema Postgres (ver NutritionalPlanEntity). Solo cubre los campos propios de
// NutritionalPlan; las tablas hijas (PlanMealTime, PlanSupplement, PlanSportsRecommendation) no se
// pueblan todavía.

import { NutritionPlanDto } from '../../domain/dtos/nutrition-plan.dto';
import { CreateNutritionalPlanDto } from '../../domain/dtos/clinical-domain/nutritional-plan/create-nutritional-plan.dto';

export function mapPlanToNutritionalPlanDto(
  plan: NutritionPlanDto,
  consultationId: string,
  orderId: string,
  pdfKey: string,
): CreateNutritionalPlanDto & { orderId: string } {
  const { prescription, planIntake } = plan;

  return {
    consultationId,
    orderId,
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
    // Se guarda la key de S3 (no una URL firmada, que expira); mismo valor que Order.pdfKey.
    pdfUrl: pdfKey,
  };
}
