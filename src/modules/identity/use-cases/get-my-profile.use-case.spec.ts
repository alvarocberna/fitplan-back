import { GetMyProfileUseCase } from './get-my-profile.use-case';
import { CurrentUserResolver } from '../current-user.resolver';
import type { CognitoUserClaims } from '../../../common/auth/cognito-user.decorator';

describe('GetMyProfileUseCase', () => {
  let useCase: GetMyProfileUseCase;
  let currentUser: { resolve: jest.Mock; isProfileComplete: jest.Mock };

  const claims: CognitoUserClaims = { sub: 'test-sub' };

  beforeEach(() => {
    currentUser = { resolve: jest.fn(), isProfileComplete: jest.fn() };
    useCase = new GetMyProfileUseCase(currentUser as unknown as CurrentUserResolver);
  });

  it('resuelve el User por el token y devuelve el perfil completo con edad y profileComplete', async () => {
    const user = {
      id: 'user-1',
      email: 'ana@example.com',
      rut: '12345678',
      rutCheckDigit: '5',
      firstName: 'Ana',
      middleName: null,
      paternalLastName: 'Pérez',
      maternalLastName: null,
      gender: 'F',
      dateOfBirth: new Date('1995-01-01'),
      photoUrl: null,
      athlete: true,
    };
    currentUser.resolve.mockResolvedValue(user);
    currentUser.isProfileComplete.mockReturnValue(true);

    const result = await useCase.execute({ claims });

    expect(currentUser.resolve).toHaveBeenCalledWith(claims);
    expect(result).toEqual({
      email: 'ana@example.com',
      rut: '12345678',
      rutCheckDigit: '5',
      firstName: 'Ana',
      middleName: null,
      paternalLastName: 'Pérez',
      maternalLastName: null,
      gender: 'F',
      dateOfBirth: new Date('1995-01-01'),
      age: expect.any(Number),
      athlete: true,
      photoUrl: null,
      profileComplete: true,
    });
  });

  it('con el perfil sin completar devuelve los campos en null, age null y profileComplete false', async () => {
    currentUser.resolve.mockResolvedValue({
      id: 'user-1',
      email: 'ana@example.com',
      rut: null,
      rutCheckDigit: null,
      firstName: null,
      middleName: null,
      paternalLastName: null,
      maternalLastName: null,
      gender: null,
      dateOfBirth: null,
      photoUrl: null,
      athlete: false,
    });
    currentUser.isProfileComplete.mockReturnValue(false);

    const result = await useCase.execute({ claims });

    expect(result).toMatchObject({
      firstName: null,
      dateOfBirth: null,
      age: null,
      profileComplete: false,
    });
  });
});
