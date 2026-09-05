import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../orm/prisma/prisma.service';
import { DietaryRecall24hMealDatasource } from '../../../domain/datasources/clinical-domain/dietary-recall-24h-meal.datasource';
import { DietaryRecall24hMealEntity } from '../../../domain/entities/anamnesis.entity';
import {
  CreateDietaryRecall24hMealDto,
  UpdateDietaryRecall24hMealDto,
} from '../../../domain';

@Injectable()
export class DietaryRecall24hMealDatasourceImpl
  implements DietaryRecall24hMealDatasource
{
  constructor(private readonly prisma: PrismaService) {}

  async createDietaryRecall24hMeal(
    createDietaryRecall24hMealDto: CreateDietaryRecall24hMealDto,
  ): Promise<DietaryRecall24hMealEntity> {
    return this.prisma.dietaryRecall24hMeal.create({
      data: createDietaryRecall24hMealDto,
    });
  }

  async getDietaryRecall24hMealById(
    id: string,
  ): Promise<DietaryRecall24hMealEntity | null> {
    return this.prisma.dietaryRecall24hMeal.findUnique({ where: { id } });
  }

  async updateDietaryRecall24hMealById(
    id: string,
    updateDietaryRecall24hMealDto: UpdateDietaryRecall24hMealDto,
  ): Promise<DietaryRecall24hMealEntity> {
    return this.prisma.dietaryRecall24hMeal.update({
      where: { id },
      data: updateDietaryRecall24hMealDto,
    });
  }

  async deleteDietaryRecall24hMealById(id: string): Promise<void> {
    await this.prisma.dietaryRecall24hMeal.delete({ where: { id } });
  }
}
