import { ClinicalConditionEntity } from '../../../entities/anamnesis.entity';

export type CreateClinicalConditionDto = Omit<
  ClinicalConditionEntity,
  'id' | 'anamnesisClinical'
>;
