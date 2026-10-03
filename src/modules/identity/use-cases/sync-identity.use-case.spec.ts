import { SyncIdentityUseCase } from './sync-identity.use-case';
import { CurrentUserResolver } from '../current-user.resolver';
import { AuthIdentityRepository } from '../../../domain/repositories/identity-auth/auth-identity.repository';
import { UserRepository } from '../../../domain/repositories/identity-auth/user.repository';
import { AuthProvider } from '../../../domain/entities/user.entity';
import type { CognitoUserClaims } from '../../../common/auth/cognito-user.decorator';

describe('SyncIdentityUseCase', () => {
  let useCase: SyncIdentityUseCase;
  let authIdentityRepository: {
    findAuthIdentityByProvider: jest.Mock;
    findOrCreateAuthIdentity: jest.Mock;
  };
  let userRepository: { getUserById: jest.Mock; findOrCreateUserByEmail: jest.Mock };
  let currentUser: { isProfileComplete: jest.Mock };

  const claims: CognitoUserClaims = { sub: 'sub-1' };

  beforeEach(() => {
    authIdentityRepository = {
      findAuthIdentityByProvider: jest.fn(),
      findOrCreateAuthIdentity: jest.fn(),
    };
    userRepository = { getUserById: jest.fn(), findOrCreateUserByEmail: jest.fn() };
    currentUser = { isProfileComplete: jest.fn().mockReturnValue(false) };
    useCase = new SyncIdentityUseCase(
      authIdentityRepository as unknown as AuthIdentityRepository,
      userRepository as unknown as UserRepository,
      currentUser as unknown as CurrentUserResolver,
    );
  });

  it('si la identidad ya existe devuelve el perfil de su User sin crear nada', async () => {
    authIdentityRepository.findAuthIdentityByProvider.mockResolvedValue({
      id: 'identity-1',
      userId: 'user-1',
    });
    userRepository.getUserById.mockResolvedValue({ id: 'user-1', email: 'ana@example.com' });

    const result = await useCase.execute({ claims, email: 'ana@example.com' });

    expect(result).toMatchObject({ email: 'ana@example.com', profileComplete: false });
    expect(userRepository.findOrCreateUserByEmail).not.toHaveBeenCalled();
    expect(authIdentityRepository.findOrCreateAuthIdentity).not.toHaveBeenCalled();
  });

  it('la primera vez crea el User esqueleto (por email) y su AuthIdentity primaria', async () => {
    authIdentityRepository.findAuthIdentityByProvider.mockResolvedValue(null);
    userRepository.findOrCreateUserByEmail.mockResolvedValue({
      id: 'user-1',
      email: 'ana@example.com',
    });

    await useCase.execute({ claims, email: 'ana@example.com' });

    expect(userRepository.findOrCreateUserByEmail).toHaveBeenCalledWith({
      email: 'ana@example.com',
    });
    expect(authIdentityRepository.findOrCreateAuthIdentity).toHaveBeenCalledWith({
      userId: 'user-1',
      provider: AuthProvider.COGNITO,
      providerUserId: 'sub-1',
      email: 'ana@example.com',
      emailVerified: false,
      isPrimary: true,
    });
  });

  it('si el AuthIdentity apunta a un User inexistente lanza un error interno', async () => {
    authIdentityRepository.findAuthIdentityByProvider.mockResolvedValue({
      id: 'identity-1',
      userId: 'user-x',
    });
    userRepository.getUserById.mockResolvedValue(null);

    await expect(useCase.execute({ claims, email: 'ana@example.com' })).rejects.toThrow(
      'User inexistente',
    );
  });
});
