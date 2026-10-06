import { AuthIdentityEntity } from '../../../entities/user.entity';

export type CreateAuthIdentityDto = Omit<
  AuthIdentityEntity,
  'id' | 'createdAt' | 'user'
>;
