import { NutritionalPlanEntity } from '../../entities/nutritional-plan.entity';
import { CreateNutritionalPlanDto, UpdateNutritionalPlanDto } from '../..';

export abstract class NutritionalPlanDatasource {
  abstract createNutritionalPlan(
    createNutritionalPlanDto: CreateNutritionalPlanDto,
  ): Promise<NutritionalPlanEntity>;

  // Idempotente por orderId (NutritionalPlan.orderId es @unique): permite que el loop de reintentos de
  // plan-generation vuelva a pasar por acá sin duplicar ni fallar.
  abstract upsertNutritionalPlanByOrderId(
    dto: CreateNutritionalPlanDto & { orderId: string },
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
