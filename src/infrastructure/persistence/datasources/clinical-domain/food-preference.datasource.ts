import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../orm/prisma/prisma.service';
import { FoodPreferenceDatasource } from '../../../../domain/datasources/clinical-domain/food-preference.datasource';
import { FoodPreferenceEntity } from '../../../../domain/entities/anamnesis.entity';
import {
  CreateFoodPreferenceDto,
  UpdateFoodPreferenceDto,
} from '../../../../domain';

@Injectable()
export class FoodPreferenceDatasourceImpl implements FoodPreferenceDatasource {
  constructor(private readonly prisma: PrismaService) {}

  async createFoodPreference(
    createFoodPreferenceDto: CreateFoodPreferenceDto,
  ): Promise<FoodPreferenceEntity> {
    return this.prisma.foodPreference.create({ data: createFoodPreferenceDto });
  }

  async getFoodPreferenceById(
    id: string,
  ): Promise<FoodPreferenceEntity | null> {
    return this.prisma.foodPreference.findUnique({ where: { id } });
  }

  async updateFoodPreferenceById(
    id: string,
    updateFoodPreferenceDto: UpdateFoodPreferenceDto,
  ): Promise<FoodPreferenceEntity> {
    return this.prisma.foodPreference.update({
      where: { id },
      data: updateFoodPreferenceDto,
    });
  }

  async deleteFoodPreferenceById(id: string): Promise<void> {
    await this.prisma.foodPreference.delete({ where: { id } });
  }
}
