import { NutritionalPlanEntity } from '../../entities/nutritional-plan.entity';
import { CreateNutritionalPlanDto, UpdateNutritionalPlanDto } from '../..';

export abstract class NutritionalPlanRepository {
  abstract createNutritionalPlan(
    createNutritionalPlanDto: CreateNutritionalPlanDto,
  ): Promise<NutritionalPlanEntity>;
  abstract getNutritionalPlanById(
    id: string,
  ): Promise<NutritionalPlanEntity | null>;
  abstract updateNutritionalPlanById(
    id: string,
    updateNutritionalPlanDto: UpdateNutritionalPlanDto,
  ): Promise<NutritionalPlanEntity>;
  abstract deleteNutritionalPlanById(id: string): Promise<void>;
  // NutritionalPlan principal más reciente (por start_date) del usuario que tiene fecha de término,
  // con su plan y la última proyección de ese plan. null si no hay ninguno.
  abstract getLatestDatedMainPlanWithProjectionByUserId(
    userId: string,
  ): Promise<NutritionalPlanEntity | null>;
}
