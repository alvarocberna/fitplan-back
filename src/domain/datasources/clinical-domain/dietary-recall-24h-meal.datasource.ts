import { DietaryRecall24hMealEntity } from '../../entities/anamnesis.entity';
import {
  CreateDietaryRecall24hMealDto,
  UpdateDietaryRecall24hMealDto,
} from '../..';

export abstract class DietaryRecall24hMealDatasource {
  abstract createDietaryRecall24hMeal(
    createDietaryRecall24hMealDto: CreateDietaryRecall24hMealDto,
  ): Promise<DietaryRecall24hMealEntity>;
  abstract getDietaryRecall24hMealById(
    id: string,
  ): Promise<DietaryRecall24hMealEntity | null>;
  abstract updateDietaryRecall24hMealById(
    id: string,
    updateDietaryRecall24hMealDto: UpdateDietaryRecall24hMealDto,
  ): Promise<DietaryRecall24hMealEntity>;
  abstract deleteDietaryRecall24hMealById(id: string): Promise<void>;
}
