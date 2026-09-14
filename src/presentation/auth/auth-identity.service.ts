import { Injectable } from '@nestjs/common';
import { AuthIdentityRepository } from '../../domain/repositories/identity-auth/auth-identity.repository';
import { UserRepository } from '../../domain/repositories/identity-auth/user.repository';
import { UserEntity } from '../../domain/entities/user.entity';
import { FindOrCreateUserByEmailDto } from '../../domain';
import { CognitoUserClaims } from './cognito-user.decorator';

@Injectable()
export class AuthIdentityService {
  constructor(
    private readonly authIdentityRepository: AuthIdentityRepository,
    private readonly userRepository: UserRepository,
  ) {}

  async resolveUser(
    claims: CognitoUserClaims,
    personalInfo: FindOrCreateUserByEmailDto,
  ): Promise<UserEntity> {
    const existing = await this.authIdentityRepository.findAuthIdentityByProvider(
      'COGNITO',
      claims.sub,
    );

    if (existing) {
      const user = await this.userRepository.getUserById(existing.userId);
      if (!user) {
        throw new Error(
          `AuthIdentity ${existing.id} apunta a un User inexistente (${existing.userId})`,
        );
      }
      return user;
    }

    // Primera vez que se ve este sub de Cognito: se resuelve/crea el User por email (mismo
    // camino que el flujo sin auth) y se vincula con una AuthIdentity nueva. El access_token
    // no trae email/email_verified (ver cognito-auth.guard.ts) — se usa el del formulario.
    const user = await this.userRepository.findOrCreateUserByEmail(personalInfo);

    await this.authIdentityRepository.createAuthIdentity({
      userId: user.id,
      provider: 'COGNITO',
      providerUserId: claims.sub,
      email: personalInfo.email,
      emailVerified: false,
      isPrimary: true,
    });

    return user;
  }
}
