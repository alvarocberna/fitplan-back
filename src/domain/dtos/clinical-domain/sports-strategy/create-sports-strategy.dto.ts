import { SportsStrategyEntity } from '../../../entities/anamnesis.entity';

export type CreateSportsStrategyDto = Omit<
  SportsStrategyEntity,
  'id' | 'lifestyle'
>;
