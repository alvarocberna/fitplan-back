import { AuthIdentityEntity, AuthProvider } from '../../entities/user.entity';
import { CreateAuthIdentityDto, UpdateAuthIdentityDto } from '../..';

export abstract class AuthIdentityDatasource {
  abstract createAuthIdentity(
    createAuthIdentityDto: CreateAuthIdentityDto,
  ): Promise<AuthIdentityEntity>;
  abstract getAuthIdentityById(id: string): Promise<AuthIdentityEntity | null>;
  abstract updateAuthIdentityById(
    id: string,
    updateAuthIdentityDto: UpdateAuthIdentityDto,
  ): Promise<AuthIdentityEntity>;
  abstract deleteAuthIdentityById(id: string): Promise<void>;
  // Idempotente: devuelve la identidad de (provider, providerUserId), creándola si no existe.
  abstract findOrCreateAuthIdentity(
    createAuthIdentityDto: CreateAuthIdentityDto,
  ): Promise<AuthIdentityEntity>;
  abstract findAuthIdentityByProvider(
    provider: AuthProvider,
    providerUserId: string,
  ): Promise<AuthIdentityEntity | null>;
}
