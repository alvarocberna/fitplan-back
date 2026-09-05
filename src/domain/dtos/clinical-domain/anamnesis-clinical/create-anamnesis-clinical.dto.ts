import { AnamnesisClinicalEntity } from '../../../entities/anamnesis.entity';

export type CreateAnamnesisClinicalDto = Omit<
  AnamnesisClinicalEntity,
  'id' | 'anamnesis' | 'clinicalConditions'
>;
