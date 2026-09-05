import { PlanSupplementEntity } from '../../entities/nutritional-plan.entity';
import { CreatePlanSupplementDto, UpdatePlanSupplementDto } from '../..';

export abstract class PlanSupplementRepository {
  abstract createPlanSupplement(
    createPlanSupplementDto: CreatePlanSupplementDto,
  ): Promise<PlanSupplementEntity>;
  abstract getPlanSupplementById(
    id: string,
  ): Promise<PlanSupplementEntity | null>;
  abstract updatePlanSupplementById(
    id: string,
    updatePlanSupplementDto: UpdatePlanSupplementDto,
  ): Promise<PlanSupplementEntity>;
  abstract deletePlanSupplementById(id: string): Promise<void>;
}
