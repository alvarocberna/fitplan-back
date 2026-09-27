import { Test, TestingModule } from '@nestjs/testing';
import { MeController } from './me.controller';
import { SyncIdentityUseCase } from './use-cases/sync-identity.use-case';
import { GetMyProfileUseCase } from './use-cases/get-my-profile.use-case';
import { UpdateMyProfileUseCase } from './use-cases/update-my-profile.use-case';
import { GetMySummaryUseCase } from './use-cases/get-my-summary.use-case';
import type { CognitoUserClaims } from '../../common/auth/cognito-user.decorator';
import { ProfileDto } from './dto/profile.dto';
import { SummaryDto } from './dto/summary.dto';

describe('MeController', () => {
  let controller: MeController;
  let syncIdentity: { execute: jest.Mock };
  let getMyProfile: { execute: jest.Mock };
  let updateMyProfile: { execute: jest.Mock };
  let getMySummary: { execute: jest.Mock };

  const claims: CognitoUserClaims = { sub: 'test-sub' };
  const profile = { email: 'ana@example.com', profileComplete: true } as ProfileDto;

  beforeEach(async () => {
    syncIdentity = { execute: jest.fn() };
    getMyProfile = { execute: jest.fn() };
    updateMyProfile = { execute: jest.fn() };
    getMySummary = { execute: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [MeController],
      providers: [
        { provide: SyncIdentityUseCase, useValue: syncIdentity },
        { provide: GetMyProfileUseCase, useValue: getMyProfile },
        { provide: UpdateMyProfileUseCase, useValue: updateMyProfile },
        { provide: GetMySummaryUseCase, useValue: getMySummary },
      ],
    }).compile();

    controller = module.get(MeController);
  });

  it('sync() delega en SyncIdentityUseCase con los claims y el email del body', async () => {
    syncIdentity.execute.mockResolvedValue(profile);

    await expect(controller.sync({ email: 'ana@example.com' }, claims)).resolves.toBe(profile);
    expect(syncIdentity.execute).toHaveBeenCalledWith({ claims, email: 'ana@example.com' });
  });

  it('get() delega en GetMyProfileUseCase', async () => {
    getMyProfile.execute.mockResolvedValue(profile);

    await expect(controller.get(claims)).resolves.toBe(profile);
    expect(getMyProfile.execute).toHaveBeenCalledWith({ claims });
  });

  it('update() delega en UpdateMyProfileUseCase con el body tal cual', async () => {
    updateMyProfile.execute.mockResolvedValue(profile);
    const body = { firstName: 'Ana', athlete: true };

    await expect(controller.update(body, claims)).resolves.toBe(profile);
    expect(updateMyProfile.execute).toHaveBeenCalledWith({ claims, data: body });
  });

  it('summary() delega en GetMySummaryUseCase', async () => {
    const summary = { firstName: 'Ana', goal: 'bajar de peso' } as SummaryDto;
    getMySummary.execute.mockResolvedValue(summary);

    await expect(controller.summary(claims)).resolves.toBe(summary);
    expect(getMySummary.execute).toHaveBeenCalledWith({ claims });
  });
});
