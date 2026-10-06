import { PlanEntity } from '../../entities/plan.entity';
import {
  CreatePlanDto,
  UpdatePlanDto,
  UpsertPlanWithMainNutritionalPlanDto,
} from '../..';

export abstract class PlanRepository {
  abstract createPlan(createPlanDto: CreatePlanDto): Promise<PlanEntity>;
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
