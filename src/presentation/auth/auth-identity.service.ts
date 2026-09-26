import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthIdentityRepository } from '../../domain/repositories/identity-auth/auth-identity.repository';
import { UserRepository } from '../../domain/repositories/identity-auth/user.repository';
import {
  AuthProvider,
  UserEntity,
} from '../../domain/entities/user.entity';
import { UpdateUserDto } from '../../domain';
import { CognitoUserClaims } from './cognito-user.decorator';

@Injectable()
export class AuthIdentityService {
  constructor(
    private readonly authIdentityRepository: AuthIdentityRepository,
    private readonly userRepository: UserRepository,
  ) {}

  // Usado por POST /auth/perfil: idempotente, crea el AuthIdentity + User "esqueleto" la primera
  // vez que se ve este sub. Reutiliza un User preexistente por email si ya existía (compat con
  // órdenes creadas antes de este sistema de auth).
  async syncUser(claims: CognitoUserClaims, email: string): Promise<UserEntity> {
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

    // El access_token no trae email/nombre (ver cognito-auth.guard.ts) — el resto del perfil se
    // completa después vía updateProfile(), disparado por PATCH /auth/perfil.
    const user = await this.userRepository.findOrCreateUserByEmail({ email });

    await this.authIdentityRepository.createAuthIdentity({
      userId: user.id,
      provider: AuthProvider.COGNITO,
      providerUserId: claims.sub,
      email,
      emailVerified: false,
      isPrimary: true,
    });

    return user;
  }

  // Usado por rutas que ya exigen un User existente (ordenes/crear, consulta/chat si lo
  // necesitara) — no crea nada, falla si todavía no se sincronizó la identidad.
  async getUserBySub(claims: CognitoUserClaims): Promise<UserEntity> {
    const existing = await this.authIdentityRepository.findAuthIdentityByProvider(
      AuthProvider.COGNITO,
      claims.sub,
    );
    if (!existing) {
      throw new UnauthorizedException(
        'No hay una identidad registrada — sincroniza tu cuenta primero',
      );
    }
    const user = await this.userRepository.getUserById(existing.userId);
    if (!user) {
      throw new Error(
        `AuthIdentity ${existing.id} apunta a un User inexistente (${existing.userId})`,
      );
    }
    return user;
  }

  isProfileComplete(user: UserEntity): boolean {
    return Boolean(
      user.firstName && user.paternalLastName && user.gender && user.dateOfBirth,
    );
  }

  async updateProfile(
    claims: CognitoUserClaims,
    data: UpdateUserDto,
  ): Promise<UserEntity> {
    const user = await this.getUserBySub(claims);
    return this.userRepository.updateUserById(user.id, data);
  }
}
