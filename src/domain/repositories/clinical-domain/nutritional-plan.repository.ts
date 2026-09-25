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
}
