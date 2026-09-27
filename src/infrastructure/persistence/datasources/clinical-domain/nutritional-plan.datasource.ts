import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../orm/prisma/prisma.service';
import { NutritionalPlanDatasource } from '../../../../domain/datasources/clinical-domain/nutritional-plan.datasource';
import { NutritionalPlanEntity } from '../../../../domain/entities/nutritional-plan.entity';
import {
  CreateNutritionalPlanDto,
  UpdateNutritionalPlanDto,
} from '../../../../domain';

@Injectable()
export class NutritionalPlanDatasourceImpl
  implements NutritionalPlanDatasource
{
  constructor(private readonly prisma: PrismaService) {}

  async createNutritionalPlan(
    createNutritionalPlanDto: CreateNutritionalPlanDto,
  ): Promise<NutritionalPlanEntity> {
    return this.prisma.nutritionalPlan.create({
      data: createNutritionalPlanDto,
    });
  }

  async getNutritionalPlanById(
    id: string,
  ): Promise<NutritionalPlanEntity | null> {
    return this.prisma.nutritionalPlan.findUnique({ where: { id } });
  }

  async updateNutritionalPlanById(
    id: string,
    updateNutritionalPlanDto: UpdateNutritionalPlanDto,
  ): Promise<NutritionalPlanEntity> {
    return this.prisma.nutritionalPlan.update({
      where: { id },
      data: updateNutritionalPlanDto,
    });
  }

  async deleteNutritionalPlanById(id: string): Promise<void> {
    await this.prisma.nutritionalPlan.delete({ where: { id } });
  }
}
