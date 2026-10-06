import { UserEntity } from '../../entities/user.entity';
import {
  CreateUserDto,
  UpdateUserDto,
  FindOrCreateUserByEmailDto,
} from '../..';

export abstract class UserRepository {
  abstract createUser(createUserDto: CreateUserDto): Promise<UserEntity>;
  abstract getUserById(id: string): Promise<UserEntity | null>;
  abstract updateUserById(
    id: string,
    updateUserDto: UpdateUserDto,
  ): Promise<UserEntity>;
  abstract deleteUserById(id: string): Promise<void>;
  abstract findOrCreateUserByEmail(
    dto: FindOrCreateUserByEmailDto,
  ): Promise<UserEntity>;
}
