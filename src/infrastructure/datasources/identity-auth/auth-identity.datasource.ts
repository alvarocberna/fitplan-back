import { Injectable } from '@nestjs/common';
import { AuthIdentity as PrismaAuthIdentity } from '../../../../generated/prisma';
import { PrismaService } from '../../orm/prisma/prisma.service';
import { AuthIdentityDatasource } from '../../../domain/datasources/identity-auth/auth-identity.datasource';
import {
  AuthIdentityEntity,
  AuthProvider,
} from '../../../domain/entities/user.entity';
import { CreateAuthIdentityDto, UpdateAuthIdentityDto } from '../../../domain';

@Injectable()
export class AuthIdentityDatasourceImpl implements AuthIdentityDatasource {
  constructor(private readonly prisma: PrismaService) {}

  // `provider` se guarda como String en Postgres (sin enum nativo en el schema); se castea acá
  // porque las escrituras siempre pasan por CreateAuthIdentityDto, que ya lo tipa como AuthProvider.
  private toEntity(authIdentity: PrismaAuthIdentity): AuthIdentityEntity {
    return { ...authIdentity, provider: authIdentity.provider as AuthProvider };
  }

  async createAuthIdentity(
    createAuthIdentityDto: CreateAuthIdentityDto,
  ): Promise<AuthIdentityEntity> {
    const authIdentity = await this.prisma.authIdentity.create({
      data: createAuthIdentityDto,
    });
    return this.toEntity(authIdentity);
  }

  async getAuthIdentityById(id: string): Promise<AuthIdentityEntity | null> {
    const authIdentity = await this.prisma.authIdentity.findUnique({
      where: { id },
    });
    return authIdentity ? this.toEntity(authIdentity) : null;
  }

  async updateAuthIdentityById(
    id: string,
    updateAuthIdentityDto: UpdateAuthIdentityDto,
  ): Promise<AuthIdentityEntity> {
    const authIdentity = await this.prisma.authIdentity.update({
      where: { id },
      data: updateAuthIdentityDto,
    });
    return this.toEntity(authIdentity);
  }

  async deleteAuthIdentityById(id: string): Promise<void> {
    await this.prisma.authIdentity.delete({ where: { id } });
  }
}
