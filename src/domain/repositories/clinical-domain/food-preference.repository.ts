import { FoodPreferenceEntity } from '../../entities/anamnesis.entity';
import { CreateFoodPreferenceDto, UpdateFoodPreferenceDto } from '../..';

export abstract class FoodPreferenceRepository {
  abstract createFoodPreference(
    createFoodPreferenceDto: CreateFoodPreferenceDto,
  ): Promise<FoodPreferenceEntity>;
  abstract getFoodPreferenceById(
    id: string,
  ): Promise<FoodPreferenceEntity | null>;
  abstract updateFoodPreferenceById(
    id: string,
    updateFoodPreferenceDto: UpdateFoodPreferenceDto,
  ): Promise<FoodPreferenceEntity>;
  abstract deleteFoodPreferenceById(id: string): Promise<void>;
}
