import { Injectable } from '@nestjs/common';
import { FoodPreferenceRepository } from '../../../domain/repositories/clinical-domain/food-preference.repository';
import { FoodPreferenceDatasource } from '../../../domain/datasources/clinical-domain/food-preference.datasource';
import { FoodPreferenceEntity } from '../../../domain/entities/anamnesis.entity';
import {
  CreateFoodPreferenceDto,
  UpdateFoodPreferenceDto,
} from '../../../domain';

@Injectable()
export class FoodPreferenceRepositoryImpl implements FoodPreferenceRepository {
  constructor(private readonly datasource: FoodPreferenceDatasource) {}

  createFoodPreference(
    createFoodPreferenceDto: CreateFoodPreferenceDto,
  ): Promise<FoodPreferenceEntity> {
    return this.datasource.createFoodPreference(createFoodPreferenceDto);
  }

  getFoodPreferenceById(id: string): Promise<FoodPreferenceEntity | null> {
    return this.datasource.getFoodPreferenceById(id);
  }

  updateFoodPreferenceById(
    id: string,
    updateFoodPreferenceDto: UpdateFoodPreferenceDto,
  ): Promise<FoodPreferenceEntity> {
    return this.datasource.updateFoodPreferenceById(
      id,
      updateFoodPreferenceDto,
    );
  }

  deleteFoodPreferenceById(id: string): Promise<void> {
    return this.datasource.deleteFoodPreferenceById(id);
  }
}
