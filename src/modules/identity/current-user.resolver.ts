import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthIdentityRepository } from '../../domain/repositories/identity-auth/auth-identity.repository';
import { UserRepository } from '../../domain/repositories/identity-auth/user.repository';
import {
  AuthProvider,
  UserEntity,
} from '../../domain/entities/user.entity';
import { ErrorCode } from '../../common/errors/error-codes';
import { CognitoUserClaims } from '../../common/auth/cognito-user.decorator';

// R1 (use-cases.md): todo caso de uso autenticado resuelve el usuario desde el token, nunca desde
// un userId recibido en body/URL. `identity` lo exporta para el resto de los módulos.
@Injectable()
export class CurrentUserResolver {
  constructor(
    private readonly authIdentityRepository: AuthIdentityRepository,
    private readonly userRepository: UserRepository,
  ) {}

  // sub de Cognito -> auth_identity -> user. No crea nada: falla si todavía no se sincronizó la
  // identidad (POST /me/sync).
  async resolve(claims: CognitoUserClaims): Promise<UserEntity> {
    const existing = await this.authIdentityRepository.findAuthIdentityByProvider(
      AuthProvider.COGNITO,
      claims.sub,
    );
    if (!existing) {
      throw new UnauthorizedException({
        code: ErrorCode.IDENTITY_NOT_SYNCED,
        message: 'No hay una identidad registrada — sincroniza tu cuenta primero',
      });
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
}
