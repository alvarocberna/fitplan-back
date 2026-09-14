import { Injectable } from '@nestjs/common';
import { AuthIdentityRepository } from '../../../domain/repositories/identity-auth/auth-identity.repository';
import { AuthIdentityDatasource } from '../../../domain/datasources/identity-auth/auth-identity.datasource';
import { AuthIdentityEntity, AuthProvider } from '../../../domain/entities/user.entity';
import { CreateAuthIdentityDto, UpdateAuthIdentityDto } from '../../../domain';

@Injectable()
export class AuthIdentityRepositoryImpl implements AuthIdentityRepository {
  constructor(private readonly datasource: AuthIdentityDatasource) {}

  createAuthIdentity(
    createAuthIdentityDto: CreateAuthIdentityDto,
  ): Promise<AuthIdentityEntity> {
    return this.datasource.createAuthIdentity(createAuthIdentityDto);
  }

  getAuthIdentityById(id: string): Promise<AuthIdentityEntity | null> {
    return this.datasource.getAuthIdentityById(id);
  }

  updateAuthIdentityById(
    id: string,
    updateAuthIdentityDto: UpdateAuthIdentityDto,
  ): Promise<AuthIdentityEntity> {
    return this.datasource.updateAuthIdentityById(id, updateAuthIdentityDto);
  }

  deleteAuthIdentityById(id: string): Promise<void> {
    return this.datasource.deleteAuthIdentityById(id);
  }

  findAuthIdentityByProvider(
    provider: AuthProvider,
    providerUserId: string,
  ): Promise<AuthIdentityEntity | null> {
    return this.datasource.findAuthIdentityByProvider(provider, providerUserId);
  }
}
