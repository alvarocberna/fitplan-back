import { CreateNutritionalPlanDto } from '../nutritional-plan/create-nutritional-plan.dto';

// Input de PlanRepository.upsertPlanWithMainNutritionalPlanByOrderId: el Plan se identifica por su
// orderId (@unique) y el NutritionalPlan principal se crea/reemplaza dentro de él (su planId lo
// resuelve la escritura anidada).
export interface UpsertPlanWithMainNutritionalPlanDto {
  consultationId: string;
  orderId: string;
  nutritionalPlan: Omit<CreateNutritionalPlanDto, 'planId'>;
}
