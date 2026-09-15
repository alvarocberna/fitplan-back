import { Test, TestingModule } from '@nestjs/testing';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import type { CognitoUserClaims } from '../auth/cognito-user.decorator';
import {
  UpdateUserProfileDtoImpl,
  UserProfileResponseDto,
} from './dto/user-profile.dto';

describe('UserController', () => {
  let controller: UserController;
  let service: jest.Mocked<UserService>;

  const cognitoUser: CognitoUserClaims = { sub: 'test-sub' };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserController],
      providers: [
        {
          provide: UserService,
          useValue: { getProfile: jest.fn(), updateProfile: jest.fn() },
        },
      ],
    }).compile();

    controller = module.get(UserController);
    service = module.get(UserService);
  });

  it('getMe() delega en UserService.getProfile con los claims de Cognito', async () => {
    const profile: UserProfileResponseDto = {
      firstName: 'Ana',
      paternalLastName: 'Pérez',
      dateOfBirth: new Date('1995-01-01'),
      email: 'ana@example.com',
    };
    service.getProfile.mockResolvedValue(profile);

    await expect(controller.getMe(cognitoUser)).resolves.toBe(profile);
    expect(service.getProfile).toHaveBeenCalledWith(cognitoUser);
  });

  it('updateMe() delega en UserService.updateProfile con el body y los claims de Cognito', async () => {
    const body: UpdateUserProfileDtoImpl = {
      firstName: 'Ana',
      paternalLastName: 'Gómez',
      dateOfBirth: '1995-05-20',
    };
    const profile: UserProfileResponseDto = {
      firstName: 'Ana',
      paternalLastName: 'Gómez',
      dateOfBirth: new Date('1995-05-20'),
      email: 'ana@example.com',
    };
    service.updateProfile.mockResolvedValue(profile);

    await expect(controller.updateMe(body, cognitoUser)).resolves.toBe(profile);
    expect(service.updateProfile).toHaveBeenCalledWith(cognitoUser, body);
  });
});
