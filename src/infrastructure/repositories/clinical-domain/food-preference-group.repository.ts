import { Injectable } from '@nestjs/common';
import { FoodPreferenceGroupRepository } from '../../../domain/repositories/clinical-domain/food-preference-group.repository';
import { FoodPreferenceGroupDatasource } from '../../../domain/datasources/clinical-domain/food-preference-group.datasource';
import { FoodPreferenceGroupEntity } from '../../../domain/entities/anamnesis.entity';
import {
  CreateFoodPreferenceGroupDto,
  UpdateFoodPreferenceGroupDto,
} from '../../../domain';

@Injectable()
export class FoodPreferenceGroupRepositoryImpl
  implements FoodPreferenceGroupRepository
{
  constructor(private readonly datasource: FoodPreferenceGroupDatasource) {}

  createFoodPreferenceGroup(
    createFoodPreferenceGroupDto: CreateFoodPreferenceGroupDto,
  ): Promise<FoodPreferenceGroupEntity> {
    return this.datasource.createFoodPreferenceGroup(
      createFoodPreferenceGroupDto,
    );
  }

  getFoodPreferenceGroupById(
    id: string,
  ): Promise<FoodPreferenceGroupEntity | null> {
    return this.datasource.getFoodPreferenceGroupById(id);
  }

  updateFoodPreferenceGroupById(
    id: string,
    updateFoodPreferenceGroupDto: UpdateFoodPreferenceGroupDto,
  ): Promise<FoodPreferenceGroupEntity> {
    return this.datasource.updateFoodPreferenceGroupById(
      id,
      updateFoodPreferenceGroupDto,
    );
  }

  deleteFoodPreferenceGroupById(id: string): Promise<void> {
    return this.datasource.deleteFoodPreferenceGroupById(id);
  }
}
