import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../../../generated/prisma';
import { PrismaService } from '../../orm/prisma/prisma.service';
import { PlanDatasource } from '../../../../domain/datasources/clinical-domain/plan.datasource';
import { PlanEntity } from '../../../../domain/entities/plan.entity';
import {
  CreatePlanDto,
  UpdatePlanDto,
  NutritionalPlanTreeDto,
  UpsertPlanWithMainNutritionalPlanDto,
} from '../../../../domain';

@Injectable()
export class PlanDatasourceImpl implements PlanDatasource {
  constructor(private readonly prisma: PrismaService) {}

  async createPlan(createPlanDto: CreatePlanDto): Promise<PlanEntity> {
    return this.prisma.plan.create({ data: createPlanDto });
  }

  // Una sola escritura anidada (atómica): Plan -> NutritionalPlan principal -> PlanMealTime (+ notas),
  // PlanSupplement (+ notas) y PlanSportsRecommendation. En el update se borra el NutritionalPlan
  // principal previo y se crea el nuevo; sus tablas hijas se borran por ON DELETE CASCADE, así un
  // reintento de la generación reemplaza el árbol completo sin duplicarlo.
  async upsertPlanWithMainNutritionalPlanByOrderId({
    consultationId,
    orderId,
    nutritionalPlan,
  }: UpsertPlanWithMainNutritionalPlanDto): Promise<PlanEntity> {
    const nutritionalPlanCreate = toNestedCreate(nutritionalPlan);
    return this.prisma.plan.upsert({
      where: { orderId },
      create: {
        consultationId,
        orderId,
        active: true,
        nutritionalPlans: { create: nutritionalPlanCreate },
      },
      update: {
        nutritionalPlans: {
          deleteMany: { mainPlan: true },
          create: nutritionalPlanCreate,
        },
      },
      include: {
        nutritionalPlans: {
          include: {
            mealTimes: { include: { notes: true } },
            supplements: { include: { notes: true } },
            sportsRecommendations: true,
          },
        },
      },
    });
  }

  async getPlanById(id: string): Promise<PlanEntity | null> {
    return this.prisma.plan.findUnique({ where: { id } });
  }

  async updatePlanById(
    id: string,
    updatePlanDto: UpdatePlanDto,
  ): Promise<PlanEntity> {
    return this.prisma.plan.update({ where: { id }, data: updatePlanDto });
  }

  async deletePlanById(id: string): Promise<void> {
    await this.prisma.plan.delete({ where: { id } });
  }
}

// Traduce el árbol del dominio (hijos como arreglos) a la forma de escritura anidada de Prisma
// (`{ create: [...] }` en cada relación).
function toNestedCreate({
  mealTimes,
  supplements,
  sportsRecommendations,
  ...nutritionalPlan
}: NutritionalPlanTreeDto): Prisma.NutritionalPlanCreateWithoutPlanInput {
  return {
    ...nutritionalPlan,
    mealTimes: {
      create: mealTimes.map(({ notes, ...mealTime }) => ({
        ...mealTime,
        notes: { create: notes },
      })),
    },
    supplements: {
      create: supplements.map(({ notes, ...supplement }) => ({
        ...supplement,
        notes: { create: notes },
      })),
    },
    sportsRecommendations: { create: sportsRecommendations },
  };
}
