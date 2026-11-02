import { ForbiddenException, Injectable } from '@nestjs/common';
import { AuthIdentityRepository } from '../../../domain/repositories/identity-auth/auth-identity.repository';
import { UserRepository } from '../../../domain/repositories/identity-auth/user.repository';
import { AuthProvider, UserEntity } from '../../../domain/entities/user.entity';
import { IdentityProvider } from '../../../domain/ports';
import { ErrorCode } from '../../../common/errors/error-codes';
import { CognitoUserClaims } from '../../../common/auth/cognito-user.decorator';
import { CurrentUserResolver } from '../current-user.resolver';
import { ProfileDto, toProfileDto } from '../dto/profile.dto';

// CU-IDN-01. Idempotente: crea el AuthIdentity + un User "esqueleto" la primera vez que se ve este
// sub de Cognito. El frontend lo llama apenas hay sesión válida para saber si el perfil ya está completo.
//
// El email de la cuenta se le pregunta a Cognito con el access_token del usuario (IdentityProvider):
// NUNCA se toma del body. Como la identidad se liga a un User existente por email, aceptar un email
// enviado por el cliente permitiría quedarse con la cuenta (y los datos de salud) de otra persona.
@Injectable()
export class SyncIdentityUseCase {
  constructor(
    private readonly authIdentityRepository: AuthIdentityRepository,
    private readonly userRepository: UserRepository,
    private readonly currentUser: CurrentUserResolver,
    private readonly identityProvider: IdentityProvider,
  ) {}

  async execute(input: { claims: CognitoUserClaims }): Promise<ProfileDto> {
    const user = await this.findOrCreateUser(input.claims);
    return toProfileDto(user, this.currentUser.isProfileComplete(user));
  }

  private async findOrCreateUser(
    claims: CognitoUserClaims,
  ): Promise<UserEntity> {
    const existing =
      await this.authIdentityRepository.findAuthIdentityByProvider(
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

    // Primera vez que se ve este sub: recién acá se consulta a Cognito (una sola vez por cuenta).
    const email = await this.getVerifiedEmail(claims);

    // El resto del perfil se completa después con PATCH /me. Reutiliza un User preexistente por email
    // si ya existía (misma persona entrando con otro método de login, u órdenes anteriores a este
    // sistema de auth): por eso el email tiene que estar verificado por el proveedor.
    const user = await this.userRepository.findOrCreateUserByEmail({ email });

    // Idempotente: dos sincronizaciones simultáneas del mismo sub terminan con una sola identidad.
    await this.authIdentityRepository.findOrCreateAuthIdentity({
      userId: user.id,
      provider: AuthProvider.COGNITO,
      providerUserId: claims.sub,
      email,
      emailVerified: true,
      isPrimary: true,
    });

    return user;
  }

  private async getVerifiedEmail(claims: CognitoUserClaims): Promise<string> {
    if (!claims.accessToken) {
      throw new Error(
        'SyncIdentityUseCase: el guard no dejó el access_token en los claims',
      );
    }
    const identity = await this.identityProvider.getIdentity(
      claims.accessToken,
    );
    if (identity.sub !== claims.sub) {
      // el token validado y la respuesta de Cognito deben hablar de la misma cuenta
      throw new Error(
        'El sub de Cognito userInfo no coincide con el del token',
      );
    }
    if (!identity.email || !identity.emailVerified) {
      throw new ForbiddenException({
        code: ErrorCode.EMAIL_NOT_VERIFIED,
        message: 'Verifica tu correo electrónico para continuar',
      });
    }
    return identity.email;
  }
}
