// Mapea el modelo `Plan` (tabla `plan`) de prisma/schema.prisma (sección CLINICAL DOMAIN).
// Agrupa uno o más NutritionalPlan generados a partir de una NutritionalConsultation y vinculados a
// la Order que los originó (1 orden -> 1 plan). Hoy cada Plan tiene un único NutritionalPlan
// (mainPlan = true), pero el modelo soporta varios.

import type { NutritionalConsultationEntity } from './clinical-record.entity';
import type { OrderEntity } from './order.entity';
import type { NutritionalPlanEntity } from './nutritional-plan.entity';

export interface PlanEntity {
  id: string;

  consultationId: string;
  consultation?: NutritionalConsultationEntity;

  orderId: string;
  order?: OrderEntity;

  active: boolean;

  nutritionalPlans?: NutritionalPlanEntity[];
}
