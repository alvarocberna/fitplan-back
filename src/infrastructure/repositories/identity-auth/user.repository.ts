import { Injectable } from '@nestjs/common';
import { UserRepository } from '../../../domain/repositories/identity-auth/user.repository';
import { UserDatasource } from '../../../domain/datasources/identity-auth/user.datasource';
import { UserEntity } from '../../../domain/entities/user.entity';
import { CreateUserDto, UpdateUserDto } from '../../../domain';

@Injectable()
export class UserRepositoryImpl implements UserRepository {
  constructor(private readonly datasource: UserDatasource) {}

  createUser(createUserDto: CreateUserDto): Promise<UserEntity> {
    return this.datasource.createUser(createUserDto);
  }

  getUserById(id: string): Promise<UserEntity | null> {
    return this.datasource.getUserById(id);
  }

  updateUserById(
    id: string,
    updateUserDto: UpdateUserDto,
  ): Promise<UserEntity> {
    return this.datasource.updateUserById(id, updateUserDto);
  }

  deleteUserById(id: string): Promise<void> {
    return this.datasource.deleteUserById(id);
  }
}
