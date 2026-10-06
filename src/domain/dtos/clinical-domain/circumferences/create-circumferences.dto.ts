import { CircumferencesEntity } from '../../../entities/measurements.entity';

export type CreateCircumferencesDto = Omit<
  CircumferencesEntity,
  'id' | 'measurements'
>;
