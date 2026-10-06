import { FoodPreferenceGroupEntity } from '../../../entities/anamnesis.entity';

export type CreateFoodPreferenceGroupDto = Omit<
  FoodPreferenceGroupEntity,
  'id' | 'foodPreference'
>;
