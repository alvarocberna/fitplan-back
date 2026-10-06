import { PlanEntity } from '../../entities/plan.entity';
import {
  CreatePlanDto,
  UpdatePlanDto,
  UpsertPlanWithMainNutritionalPlanDto,
} from '../..';

export abstract class PlanDatasource {
  abstract createPlan(createPlanDto: CreatePlanDto): Promise<PlanEntity>;

  // Idempotente por orderId (Plan.orderId es @unique): crea el Plan con su NutritionalPlan principal,
  // o si ya existe reemplaza el NutritionalPlan principal. Permite que el loop de reintentos de
  // plan-generation vuelva a pasar por acá sin duplicar ni fallar.
  abstract upsertPlanWithMainNutritionalPlanByOrderId(
    dto: UpsertPlanWithMainNutritionalPlanDto,
  ): Promise<PlanEntity>;
  abstract getPlanById(id: string): Promise<PlanEntity | null>;
  abstract updatePlanById(
    id: string,
    updatePlanDto: UpdatePlanDto,
  ): Promise<PlanEntity>;
  abstract deletePlanById(id: string): Promise<void>;
}
