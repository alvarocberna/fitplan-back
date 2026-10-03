import { Injectable } from '@nestjs/common';
import { AuthIdentityRepository } from '../../../domain/repositories/identity-auth/auth-identity.repository';
import { UserRepository } from '../../../domain/repositories/identity-auth/user.repository';
import { AuthProvider, UserEntity } from '../../../domain/entities/user.entity';
import { CognitoUserClaims } from '../../../common/auth/cognito-user.decorator';
import { CurrentUserResolver } from '../current-user.resolver';
import { ProfileDto, toProfileDto } from '../dto/profile.dto';

// CU-IDN-01. Idempotente: crea el AuthIdentity + un User "esqueleto" la primera vez que se ve este
// sub de Cognito (email tomado de la sesión, no de un formulario). El frontend lo llama apenas hay
// sesión válida para saber si el perfil ya está completo.
@Injectable()
export class SyncIdentityUseCase {
  constructor(
    private readonly authIdentityRepository: AuthIdentityRepository,
    private readonly userRepository: UserRepository,
    private readonly currentUser: CurrentUserResolver,
  ) {}

  async execute(input: {
    claims: CognitoUserClaims;
    email: string;
  }): Promise<ProfileDto> {
    const user = await this.findOrCreateUser(input.claims, input.email);
    return toProfileDto(user, this.currentUser.isProfileComplete(user));
  }

  private async findOrCreateUser(
    claims: CognitoUserClaims,
    email: string,
  ): Promise<UserEntity> {
    const existing = await this.authIdentityRepository.findAuthIdentityByProvider(
      AuthProvider.COGNITO,
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

    // El access_token no trae email/nombre (ver cognito-auth.guard.ts): el resto del perfil se
    // completa después con PATCH /me. Reutiliza un User preexistente por email si ya existía
    // (compat con órdenes creadas antes de este sistema de auth).
    const user = await this.userRepository.findOrCreateUserByEmail({ email });

    // Idempotente: dos sincronizaciones simultáneas del mismo sub terminan con una sola identidad.
    await this.authIdentityRepository.findOrCreateAuthIdentity({
      userId: user.id,
      provider: AuthProvider.COGNITO,
      providerUserId: claims.sub,
      email,
      emailVerified: false,
      isPrimary: true,
    });

    return user;
  }
}
