import { AuthIdentityEntity } from '../../entities/user.entity';
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
}
