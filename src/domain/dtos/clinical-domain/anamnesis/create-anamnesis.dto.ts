import { AnamnesisEntity } from '../../../entities/anamnesis.entity';

export type CreateAnamnesisDto = Omit<
  AnamnesisEntity,
  | 'id'
  | 'consultation'
  | 'goals'
  | 'anamnesisClinical'
  | 'anamnesisDietary'
  | 'anamnesisPsychosocial'
  | 'lifestyles'
>;
