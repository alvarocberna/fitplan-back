import { SportsSessionEntity } from '../../../entities/anamnesis.entity';

export type CreateSportsSessionDto = Omit<
  SportsSessionEntity,
  'id' | 'lifestyle'
>;
