import { LifestyleEntity } from '../../../entities/anamnesis.entity';

export type CreateLifestyleDto = Omit<
  LifestyleEntity,
  'id' | 'anamnesis' | 'sportsSessions' | 'sportsStrategies'
>;
