import { AnamnesisDietaryEntity } from '../../../entities/anamnesis.entity';

export type CreateAnamnesisDietaryDto = Omit<
  AnamnesisDietaryEntity,
  'id' | 'anamnesis' | 'dietaryRecalls24h' | 'foodPreferences' | 'supplements'
>;
