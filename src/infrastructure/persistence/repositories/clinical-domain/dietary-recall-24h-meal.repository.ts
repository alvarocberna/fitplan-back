import { Injectable } from '@nestjs/common';
import { DietaryRecall24hMealRepository } from '../../../../domain/repositories/clinical-domain/dietary-recall-24h-meal.repository';
import { DietaryRecall24hMealDatasource } from '../../../../domain/datasources/clinical-domain/dietary-recall-24h-meal.datasource';
import { DietaryRecall24hMealEntity } from '../../../../domain/entities/anamnesis.entity';
import {
  CreateDietaryRecall24hMealDto,
  UpdateDietaryRecall24hMealDto,
} from '../../../../domain';

@Injectable()
export class DietaryRecall24hMealRepositoryImpl
  implements DietaryRecall24hMealRepository
{
  constructor(private readonly datasource: DietaryRecall24hMealDatasource) {}

  createDietaryRecall24hMeal(
    createDietaryRecall24hMealDto: CreateDietaryRecall24hMealDto,
  ): Promise<DietaryRecall24hMealEntity> {
    return this.datasource.createDietaryRecall24hMeal(
      createDietaryRecall24hMealDto,
    );
  }

  getDietaryRecall24hMealById(
    id: string,
  ): Promise<DietaryRecall24hMealEntity | null> {
    return this.datasource.getDietaryRecall24hMealById(id);
  }

  updateDietaryRecall24hMealById(
    id: string,
    updateDietaryRecall24hMealDto: UpdateDietaryRecall24hMealDto,
  ): Promise<DietaryRecall24hMealEntity> {
    return this.datasource.updateDietaryRecall24hMealById(
      id,
      updateDietaryRecall24hMealDto,
    );
  }

  deleteDietaryRecall24hMealById(id: string): Promise<void> {
    return this.datasource.deleteDietaryRecall24hMealById(id);
  }
}
