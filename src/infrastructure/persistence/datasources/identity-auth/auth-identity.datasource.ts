import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../orm/prisma/prisma.service';
import { AuthIdentityDatasource } from '../../../../domain/datasources/identity-auth/auth-identity.datasource';
import {
  AuthIdentityEntity,
  AuthProvider,
} from '../../../../domain/entities/user.entity';
import { CreateAuthIdentityDto, UpdateAuthIdentityDto } from '../../../../domain';

@Injectable()
export class AuthIdentityDatasourceImpl implements AuthIdentityDatasource {
  constructor(private readonly prisma: PrismaService) {}

  async createAuthIdentity(
    createAuthIdentityDto: CreateAuthIdentityDto,
  ): Promise<AuthIdentityEntity> {
    return this.prisma.authIdentity.create({
      data: createAuthIdentityDto,
    });
  }

  async getAuthIdentityById(id: string): Promise<AuthIdentityEntity | null> {
    return this.prisma.authIdentity.findUnique({
      where: { id },
    });
  }

  async updateAuthIdentityById(
    id: string,
    updateAuthIdentityDto: UpdateAuthIdentityDto,
  ): Promise<AuthIdentityEntity> {
    return this.prisma.authIdentity.update({
      where: { id },
      data: updateAuthIdentityDto,
    });
  }

  async deleteAuthIdentityById(id: string): Promise<void> {
    await this.prisma.authIdentity.delete({ where: { id } });
  }

  async findAuthIdentityByProvider(
    provider: AuthProvider,
    providerUserId: string,
  ): Promise<AuthIdentityEntity | null> {
    return this.prisma.authIdentity.findUnique({
      where: { provider_providerUserId: { provider, providerUserId } },
    });
  }
}
