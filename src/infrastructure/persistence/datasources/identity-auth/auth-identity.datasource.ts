import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../orm/prisma/prisma.service';
import { isUniqueConstraintError } from '../../orm/prisma/prisma-errors';
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

  async findOrCreateAuthIdentity(
    dto: CreateAuthIdentityDto,
  ): Promise<AuthIdentityEntity> {
    const where = {
      provider_providerUserId: {
        provider: dto.provider,
        providerUserId: dto.providerUserId,
      },
    };
    // upsert para que dos sincronizaciones simultáneas del mismo sub no choquen con el @@unique; si
    // aun así pierde la carrera (P2002), la identidad ya existe: se relee.
    try {
      return await this.prisma.authIdentity.upsert({
        where,
        update: {},
        create: dto,
      });
    } catch (error) {
      if (!isUniqueConstraintError(error)) throw error;
      return this.prisma.authIdentity.findUniqueOrThrow({ where });
    }
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
