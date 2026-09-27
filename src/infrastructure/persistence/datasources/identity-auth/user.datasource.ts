import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../orm/prisma/prisma.service';
import { UserDatasource } from '../../../../domain/datasources/identity-auth/user.datasource';
import { UserEntity } from '../../../../domain/entities/user.entity';
import {
  CreateUserDto,
  UpdateUserDto,
  FindOrCreateUserByEmailDto,
} from '../../../../domain';

@Injectable()
export class UserDatasourceImpl implements UserDatasource {
  constructor(private readonly prisma: PrismaService) {}

  async createUser(createUserDto: CreateUserDto): Promise<UserEntity> {
    return this.prisma.user.create({ data: createUserDto });
  }

  async getUserById(id: string): Promise<UserEntity | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  async updateUserById(
    id: string,
    updateUserDto: UpdateUserDto,
  ): Promise<UserEntity> {
    return this.prisma.user.update({ where: { id }, data: updateUserDto });
  }

  async deleteUserById(id: string): Promise<void> {
    await this.prisma.user.delete({ where: { id } });
  }

  async findOrCreateUserByEmail(
    dto: FindOrCreateUserByEmailDto,
  ): Promise<UserEntity> {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) return existing;
    return this.prisma.user.create({ data: dto });
  }
}
