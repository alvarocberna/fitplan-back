import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../orm/prisma/prisma.service';
import { PlanSportsRecommendationDatasource } from '../../../../domain/datasources/clinical-domain/plan-sports-recommendation.datasource';
import { PlanSportsRecommendationEntity } from '../../../../domain/entities/nutritional-plan.entity';
import {
  CreatePlanSportsRecommendationDto,
  UpdatePlanSportsRecommendationDto,
} from '../../../../domain';

@Injectable()
export class PlanSportsRecommendationDatasourceImpl
  implements PlanSportsRecommendationDatasource
{
  constructor(private readonly prisma: PrismaService) {}

  async createPlanSportsRecommendation(
    createPlanSportsRecommendationDto: CreatePlanSportsRecommendationDto,
  ): Promise<PlanSportsRecommendationEntity> {
    return this.prisma.planSportsRecommendation.create({
      data: createPlanSportsRecommendationDto,
    });
  }

  async getPlanSportsRecommendationById(
    id: string,
  ): Promise<PlanSportsRecommendationEntity | null> {
    return this.prisma.planSportsRecommendation.findUnique({ where: { id } });
  }

  async updatePlanSportsRecommendationById(
    id: string,
    updatePlanSportsRecommendationDto: UpdatePlanSportsRecommendationDto,
  ): Promise<PlanSportsRecommendationEntity> {
    return this.prisma.planSportsRecommendation.update({
      where: { id },
      data: updatePlanSportsRecommendationDto,
    });
  }

  async deletePlanSportsRecommendationById(id: string): Promise<void> {
    await this.prisma.planSportsRecommendation.delete({ where: { id } });
  }
}
