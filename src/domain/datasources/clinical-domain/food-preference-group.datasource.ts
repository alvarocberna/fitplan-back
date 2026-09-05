import { FoodPreferenceGroupEntity } from '../../entities/anamnesis.entity';
import {
  CreateFoodPreferenceGroupDto,
  UpdateFoodPreferenceGroupDto,
} from '../..';

export abstract class FoodPreferenceGroupDatasource {
  abstract createFoodPreferenceGroup(
    createFoodPreferenceGroupDto: CreateFoodPreferenceGroupDto,
  ): Promise<FoodPreferenceGroupEntity>;
  abstract getFoodPreferenceGroupById(
    id: string,
  ): Promise<FoodPreferenceGroupEntity | null>;
  abstract updateFoodPreferenceGroupById(
    id: string,
    updateFoodPreferenceGroupDto: UpdateFoodPreferenceGroupDto,
  ): Promise<FoodPreferenceGroupEntity>;
  abstract deleteFoodPreferenceGroupById(id: string): Promise<void>;
}
