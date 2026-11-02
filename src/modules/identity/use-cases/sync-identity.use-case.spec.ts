import { ForbiddenException } from '@nestjs/common';
import { SyncIdentityUseCase } from './sync-identity.use-case';
import { CurrentUserResolver } from '../current-user.resolver';
import { AuthIdentityRepository } from '../../../domain/repositories/identity-auth/auth-identity.repository';
import { UserRepository } from '../../../domain/repositories/identity-auth/user.repository';
import { AuthProvider } from '../../../domain/entities/user.entity';
import { IdentityProvider } from '../../../domain/ports';
import { IdentityProviderUnavailableError } from '../../../domain/errors/identity.errors';
import { ErrorCode } from '../../../common/errors/error-codes';
import type { CognitoUserClaims } from '../../../common/auth/cognito-user.decorator';

describe('SyncIdentityUseCase', () => {
  let useCase: SyncIdentityUseCase;
  let authIdentityRepository: {
    findAuthIdentityByProvider: jest.Mock;
    findOrCreateAuthIdentity: jest.Mock;
  };
  let userRepository: {
    getUserById: jest.Mock;
    findOrCreateUserByEmail: jest.Mock;
  };
  let currentUser: { isProfileComplete: jest.Mock };
  let identityProvider: { getIdentity: jest.Mock };

  const claims: CognitoUserClaims = {
    sub: 'sub-1',
    accessToken: 'access-token-1',
  };

  beforeEach(() => {
    authIdentityRepository = {
      findAuthIdentityByProvider: jest.fn(),
      findOrCreateAuthIdentity: jest.fn(),
    };
    userRepository = {
      getUserById: jest.fn(),
      findOrCreateUserByEmail: jest.fn(),
    };
    currentUser = { isProfileComplete: jest.fn().mockReturnValue(false) };
    identityProvider = {
      getIdentity: jest.fn().mockResolvedValue({
        sub: 'sub-1',
        email: 'ana@example.com',
        emailVerified: true,
      }),
    };
    useCase = new SyncIdentityUseCase(
      authIdentityRepository as unknown as AuthIdentityRepository,
      userRepository as unknown as UserRepository,
      currentUser as unknown as CurrentUserResolver,
      identityProvider as unknown as IdentityProvider,
    );
  });

  it('si la identidad ya existe devuelve el perfil de su User sin crear nada ni consultar a Cognito', async () => {
    authIdentityRepository.findAuthIdentityByProvider.mockResolvedValue({
      id: 'identity-1',
      userId: 'user-1',
    });
    userRepository.getUserById.mockResolvedValue({
      id: 'user-1',
      email: 'ana@example.com',
    });

    const result = await useCase.execute({ claims });

    expect(result).toMatchObject({
      email: 'ana@example.com',
      profileComplete: false,
    });
    expect(identityProvider.getIdentity).not.toHaveBeenCalled();
    expect(userRepository.findOrCreateUserByEmail).not.toHaveBeenCalled();
    expect(
      authIdentityRepository.findOrCreateAuthIdentity,
    ).not.toHaveBeenCalled();
  });

  it('la primera vez pide el email a Cognito con el access token y crea el User y su AuthIdentity', async () => {
    authIdentityRepository.findAuthIdentityByProvider.mockResolvedValue(null);
    userRepository.findOrCreateUserByEmail.mockResolvedValue({
      id: 'user-1',
      email: 'ana@example.com',
    });

    await useCase.execute({ claims });

    expect(identityProvider.getIdentity).toHaveBeenCalledWith('access-token-1');
    expect(userRepository.findOrCreateUserByEmail).toHaveBeenCalledWith({
      email: 'ana@example.com',
    });
    expect(
      authIdentityRepository.findOrCreateAuthIdentity,
    ).toHaveBeenCalledWith({
      userId: 'user-1',
      provider: AuthProvider.COGNITO,
      providerUserId: 'sub-1',
      email: 'ana@example.com',
      emailVerified: true,
      isPrimary: true,
    });
  });

  it.each([
    [
      'no verificado',
      { sub: 'sub-1', email: 'ana@example.com', emailVerified: false },
    ],
    ['ausente', { sub: 'sub-1', email: null, emailVerified: true }],
  ])(
    'con un email %s responde 403 EMAIL_NOT_VERIFIED y no liga la identidad a ningún User',
    async (_n, identity) => {
      authIdentityRepository.findAuthIdentityByProvider.mockResolvedValue(null);
      identityProvider.getIdentity.mockResolvedValue(identity);

      const error = await useCase.execute({ claims }).then(
        () => undefined,
        (e: ForbiddenException) => e,
      );

      expect(error).toBeInstanceOf(ForbiddenException);
      expect(error!.getResponse()).toMatchObject({
        code: ErrorCode.EMAIL_NOT_VERIFIED,
      });
      expect(userRepository.findOrCreateUserByEmail).not.toHaveBeenCalled();
      expect(
        authIdentityRepository.findOrCreateAuthIdentity,
      ).not.toHaveBeenCalled();
    },
  );

  it('si Cognito responde por otra cuenta (sub distinto) no liga nada', async () => {
    authIdentityRepository.findAuthIdentityByProvider.mockResolvedValue(null);
    identityProvider.getIdentity.mockResolvedValue({
      sub: 'sub-de-otro',
      email: 'victima@example.com',
      emailVerified: true,
    });

    await expect(useCase.execute({ claims })).rejects.toThrow('no coincide');
    expect(userRepository.findOrCreateUserByEmail).not.toHaveBeenCalled();
  });

  it('si no se puede consultar a Cognito, propaga el error del proveedor sin crear nada', async () => {
    authIdentityRepository.findAuthIdentityByProvider.mockResolvedValue(null);
    identityProvider.getIdentity.mockRejectedValue(
      new IdentityProviderUnavailableError('Cognito respondió HTTP 500'),
    );

    await expect(useCase.execute({ claims })).rejects.toBeInstanceOf(
      IdentityProviderUnavailableError,
    );
    expect(userRepository.findOrCreateUserByEmail).not.toHaveBeenCalled();
  });

  it('si el AuthIdentity apunta a un User inexistente lanza un error interno', async () => {
    authIdentityRepository.findAuthIdentityByProvider.mockResolvedValue({
      id: 'identity-1',
      userId: 'user-x',
    });
    userRepository.getUserById.mockResolvedValue(null);

    await expect(useCase.execute({ claims })).rejects.toThrow(
      'User inexistente',
    );
  });
});
