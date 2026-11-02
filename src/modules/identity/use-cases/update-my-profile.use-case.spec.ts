import { UpdateMyProfileUseCase } from './update-my-profile.use-case';
import { CurrentUserResolver } from '../current-user.resolver';
import { UserRepository } from '../../../domain/repositories/identity-auth/user.repository';
import type { CognitoUserClaims } from '../../../common/auth/cognito-user.decorator';

describe('UpdateMyProfileUseCase', () => {
  let useCase: UpdateMyProfileUseCase;
  let currentUser: { resolve: jest.Mock; isProfileComplete: jest.Mock };
  let userRepository: { updateUserById: jest.Mock };

  const claims: CognitoUserClaims = { sub: 'test-sub' };

  beforeEach(() => {
    currentUser = {
      resolve: jest.fn().mockResolvedValue({ id: 'user-1' }),
      isProfileComplete: jest.fn().mockReturnValue(true),
    };
    userRepository = {
      updateUserById: jest.fn().mockResolvedValue({
        id: 'user-1',
        firstName: 'Ana',
        dateOfBirth: new Date('1995-01-01'),
        athlete: true,
      }),
    };
    useCase = new UpdateMyProfileUseCase(
      currentUser as unknown as CurrentUserResolver,
      userRepository as unknown as UserRepository,
    );
  });

  it('actualiza solo los campos presentes y convierte dateOfBirth a Date', async () => {
    await useCase.execute({
      claims,
      data: { firstName: 'Ana', dateOfBirth: '1995-01-01', athlete: true },
    });

    expect(currentUser.resolve).toHaveBeenCalledWith(claims);
    expect(userRepository.updateUserById).toHaveBeenCalledWith('user-1', {
      firstName: 'Ana',
      dateOfBirth: new Date('1995-01-01'),
      athlete: true,
    });
  });

  it('un campo en null se envía para limpiarlo; uno ausente no se toca', async () => {
    await useCase.execute({ claims, data: { middleName: null } });

    expect(userRepository.updateUserById).toHaveBeenCalledWith('user-1', {
      middleName: null,
    });
  });

  it('devuelve el perfil actualizado con profileComplete', async () => {
    const result = await useCase.execute({
      claims,
      data: { firstName: 'Ana' },
    });

    expect(result).toMatchObject({
      firstName: 'Ana',
      athlete: true,
      profileComplete: true,
    });
    expect(currentUser.isProfileComplete).toHaveBeenCalled();
  });
});
