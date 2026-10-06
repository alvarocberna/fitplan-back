import { DietaryRecall24hMealEntity } from '../../../entities/anamnesis.entity';

export type CreateDietaryRecall24hMealDto = Omit<
  DietaryRecall24hMealEntity,
  'id' | 'dietaryRecall24h'
>;
