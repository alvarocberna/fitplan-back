import { UserEntity } from '../../../entities/user.entity';

export type CreateUserDto = Omit<
  UserEntity,
  | 'id'
  | 'createdAt'
  | 'updatedAt'
  | 'authIdentities'
  | 'clinicalRecord'
  | 'nutritionalConsultations'
  | 'orders'
>;
