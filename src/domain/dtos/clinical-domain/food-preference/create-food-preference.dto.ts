import { FoodPreferenceEntity } from '../../../entities/anamnesis.entity';

export type CreateFoodPreferenceDto = Omit<
  FoodPreferenceEntity,
  'id' | 'anamnesisDietary' | 'groups'
>;
