import { SupplementsEntity } from '../../../entities/anamnesis.entity';

export type CreateSupplementsDto = Omit<
  SupplementsEntity,
  'id' | 'anamnesisDietary'
>;
