import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../orm/prisma/prisma.service';
import { FoodPreferenceGroupDatasource } from '../../../../domain/datasources/clinical-domain/food-preference-group.datasource';
import { FoodPreferenceGroupEntity } from '../../../../domain/entities/anamnesis.entity';
import {
  CreateFoodPreferenceGroupDto,
  UpdateFoodPreferenceGroupDto,
} from '../../../../domain';

@Injectable()
export class FoodPreferenceGroupDatasourceImpl
  implements FoodPreferenceGroupDatasource
{
  constructor(private readonly prisma: PrismaService) {}

  async createFoodPreferenceGroup(
    createFoodPreferenceGroupDto: CreateFoodPreferenceGroupDto,
  ): Promise<FoodPreferenceGroupEntity> {
    return this.prisma.foodPreferenceGroup.create({
      data: createFoodPreferenceGroupDto,
    });
  }

  async getFoodPreferenceGroupById(
    id: string,
  ): Promise<FoodPreferenceGroupEntity | null> {
    return this.prisma.foodPreferenceGroup.findUnique({ where: { id } });
  }

  async updateFoodPreferenceGroupById(
    id: string,
    updateFoodPreferenceGroupDto: UpdateFoodPreferenceGroupDto,
  ): Promise<FoodPreferenceGroupEntity> {
    return this.prisma.foodPreferenceGroup.update({
      where: { id },
      data: updateFoodPreferenceGroupDto,
    });
  }

  async deleteFoodPreferenceGroupById(id: string): Promise<void> {
    await this.prisma.foodPreferenceGroup.delete({ where: { id } });
  }
}
