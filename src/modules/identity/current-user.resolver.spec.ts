import { UnauthorizedException } from '@nestjs/common';
import { CurrentUserResolver } from './current-user.resolver';
import { AuthIdentityRepository } from '../../domain/repositories/identity-auth/auth-identity.repository';
import { UserRepository } from '../../domain/repositories/identity-auth/user.repository';
import { AuthProvider, UserEntity } from '../../domain/entities/user.entity';

describe('CurrentUserResolver', () => {
  let resolver: CurrentUserResolver;
  let authIdentityRepository: { findAuthIdentityByProvider: jest.Mock };
  let userRepository: { getUserById: jest.Mock };

  beforeEach(() => {
    authIdentityRepository = { findAuthIdentityByProvider: jest.fn() };
    userRepository = { getUserById: jest.fn() };
    resolver = new CurrentUserResolver(
      authIdentityRepository as unknown as AuthIdentityRepository,
      userRepository as unknown as UserRepository,
    );
  });

  describe('resolve', () => {
    it('busca el AuthIdentity por (COGNITO, sub) y devuelve su User', async () => {
      authIdentityRepository.findAuthIdentityByProvider.mockResolvedValue({
        id: 'identity-1',
        userId: 'user-1',
      });
      userRepository.getUserById.mockResolvedValue({ id: 'user-1' });

      await expect(resolver.resolve({ sub: 'sub-1' })).resolves.toEqual({
        id: 'user-1',
      });
      expect(
        authIdentityRepository.findAuthIdentityByProvider,
      ).toHaveBeenCalledWith(AuthProvider.COGNITO, 'sub-1');
    });

    it('sin identidad sincronizada lanza 401', async () => {
      authIdentityRepository.findAuthIdentityByProvider.mockResolvedValue(null);

      await expect(resolver.resolve({ sub: 'sub-1' })).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('si el AuthIdentity apunta a un User inexistente lanza un error interno', async () => {
      authIdentityRepository.findAuthIdentityByProvider.mockResolvedValue({
        id: 'identity-1',
        userId: 'user-x',
      });
      userRepository.getUserById.mockResolvedValue(null);

      await expect(resolver.resolve({ sub: 'sub-1' })).rejects.toThrow(
        'User inexistente',
      );
    });
  });

  describe('isProfileComplete', () => {
    const complete = {
      firstName: 'Ana',
      paternalLastName: 'Pérez',
      gender: 'F',
      dateOfBirth: new Date('1995-01-01'),
    } as UserEntity;

    it('es true con nombre, apellido paterno, género y fecha de nacimiento', () => {
      expect(resolver.isProfileComplete(complete)).toBe(true);
    });

    it.each([
      'firstName',
      'paternalLastName',
      'gender',
      'dateOfBirth',
    ] as const)('es false si falta %s', (field) => {
      expect(resolver.isProfileComplete({ ...complete, [field]: null })).toBe(
        false,
      );
    });
  });
});
