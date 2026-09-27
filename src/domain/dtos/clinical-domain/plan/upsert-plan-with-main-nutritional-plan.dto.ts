import { CreateNutritionalPlanDto } from '../nutritional-plan/create-nutritional-plan.dto';
import { CreatePlanMealTimeDto } from '../plan-meal-time/create-plan-meal-time.dto';
import { CreatePlanMealTimeNoteDto } from '../plan-meal-time-note/create-plan-meal-time-note.dto';
import { CreatePlanSupplementDto } from '../plan-supplement/create-plan-supplement.dto';
import { CreatePlanSupplementNoteDto } from '../plan-supplement-note/create-plan-supplement-note.dto';
import { CreatePlanSportsRecommendationDto } from '../plan-sports-recommendation/create-plan-sports-recommendation.dto';

// NutritionalPlan con todas sus tablas hijas, tal como se crea en una sola escritura anidada: las
// FKs hacia el padre (planId, planMealTimeId, planSupplementId) las resuelve Prisma.
export type NutritionalPlanTreeDto = Omit<CreateNutritionalPlanDto, 'planId'> & {
  mealTimes: (Omit<CreatePlanMealTimeDto, 'planId'> & {
    notes: Omit<CreatePlanMealTimeNoteDto, 'planMealTimeId'>[];
  })[];
  supplements: (Omit<CreatePlanSupplementDto, 'planId'> & {
    notes: Omit<CreatePlanSupplementNoteDto, 'planSupplementId'>[];
  })[];
  sportsRecommendations: Omit<CreatePlanSportsRecommendationDto, 'planId'>[];
};

// Input de PlanRepository.upsertPlanWithMainNutritionalPlanByOrderId: el Plan se identifica por su
// orderId (@unique) y el NutritionalPlan principal (con sus hijos) se crea/reemplaza dentro de él.
export interface UpsertPlanWithMainNutritionalPlanDto {
  consultationId: string;
  orderId: string;
  nutritionalPlan: NutritionalPlanTreeDto;
}
