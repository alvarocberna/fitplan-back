import { Test, TestingModule } from '@nestjs/testing';
import { UserService } from './user.service';
import { AuthIdentityService } from '../auth/auth-identity.service';
import { UserRepository } from '../../domain/repositories/identity-auth/user.repository';
import type { CognitoUserClaims } from '../auth/cognito-user.decorator';

describe('UserService', () => {
  let service: UserService;
  let authIdentityService: jest.Mocked<AuthIdentityService>;
  let userRepository: jest.Mocked<UserRepository>;

  const cognitoUser: CognitoUserClaims = { sub: 'test-sub' };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        { provide: AuthIdentityService, useValue: { getUserBySub: jest.fn() } },
        { provide: UserRepository, useValue: { updateUserById: jest.fn() } },
      ],
    }).compile();

    service = module.get(UserService);
    authIdentityService = module.get(AuthIdentityService);
    userRepository = module.get(UserRepository);
  });

  describe('getProfile', () => {
    it('resuelve el User por el sub del token y devuelve el perfil mapeado', async () => {
      authIdentityService.getUserBySub.mockResolvedValue({
        id: 'user-1',
        firstName: 'Ana',
        paternalLastName: 'Pérez',
        dateOfBirth: new Date('1995-01-01'),
        email: 'ana@example.com',
      } as any);

      const result = await service.getProfile(cognitoUser);

      expect(authIdentityService.getUserBySub).toHaveBeenCalledWith(cognitoUser);
      expect(result).toEqual({
        firstName: 'Ana',
        paternalLastName: 'Pérez',
        dateOfBirth: new Date('1995-01-01'),
        email: 'ana@example.com',
      });
      expect(userRepository.updateUserById).not.toHaveBeenCalled();
    });

    it('propaga los campos como null si el perfil aún no se completó', async () => {
      authIdentityService.getUserBySub.mockResolvedValue({
        id: 'user-1',
        firstName: null,
        paternalLastName: null,
        dateOfBirth: null,
        email: 'ana@example.com',
      } as any);

      const result = await service.getProfile(cognitoUser);

      expect(result).toEqual({
        firstName: null,
        paternalLastName: null,
        dateOfBirth: null,
        email: 'ana@example.com',
      });
    });
  });

  describe('updateProfile', () => {
    it('resuelve el User por sub, actualiza los campos parseando dateOfBirth a Date, y devuelve el perfil mapeado', async () => {
      authIdentityService.getUserBySub.mockResolvedValue({ id: 'user-1' } as any);
      userRepository.updateUserById.mockResolvedValue({
        firstName: 'Ana',
        paternalLastName: 'Gómez',
        dateOfBirth: new Date('1995-05-20'),
        email: 'ana@example.com',
      } as any);

      const result = await service.updateProfile(cognitoUser, {
        firstName: 'Ana',
        paternalLastName: 'Gómez',
        dateOfBirth: '1995-05-20',
      });

      expect(authIdentityService.getUserBySub).toHaveBeenCalledWith(cognitoUser);
      expect(userRepository.updateUserById).toHaveBeenCalledWith('user-1', {
        firstName: 'Ana',
        paternalLastName: 'Gómez',
        dateOfBirth: new Date('1995-05-20'),
      });
      expect(result).toEqual({
        firstName: 'Ana',
        paternalLastName: 'Gómez',
        dateOfBirth: new Date('1995-05-20'),
        email: 'ana@example.com',
      });
    });
  });
});
