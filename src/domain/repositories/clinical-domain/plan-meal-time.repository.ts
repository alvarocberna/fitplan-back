import { PlanMealTimeEntity } from '../../entities/nutritional-plan.entity';
import { CreatePlanMealTimeDto, UpdatePlanMealTimeDto } from '../..';

export abstract class PlanMealTimeRepository {
  abstract createPlanMealTime(
    createPlanMealTimeDto: CreatePlanMealTimeDto,
  ): Promise<PlanMealTimeEntity>;
  abstract getPlanMealTimeById(id: string): Promise<PlanMealTimeEntity | null>;
  abstract updatePlanMealTimeById(
    id: string,
    updatePlanMealTimeDto: UpdatePlanMealTimeDto,
  ): Promise<PlanMealTimeEntity>;
  abstract deletePlanMealTimeById(id: string): Promise<void>;
}
