import { DietaryRecall24hEntity } from '../../../entities/anamnesis.entity';

export type CreateDietaryRecall24hDto = Omit<
  DietaryRecall24hEntity,
  'id' | 'anamnesisDietary' | 'meals'
>;
