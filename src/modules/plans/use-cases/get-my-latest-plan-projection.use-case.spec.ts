import { NotFoundException } from '@nestjs/common';
import { GetMyLatestPlanProjectionUseCase } from './get-my-latest-plan-projection.use-case';
import { CurrentUserResolver } from '../../identity/current-user.resolver';
import { NutritionalPlanRepository } from '../../../domain/repositories/clinical-domain/nutritional-plan.repository';
import type { CognitoUserClaims } from '../../../common/auth/cognito-user.decorator';

describe('GetMyLatestPlanProjectionUseCase', () => {
  let useCase: GetMyLatestPlanProjectionUseCase;
  let nutritionalPlanRepository: {
    getLatestDatedMainPlanWithProjectionByUserId: jest.Mock;
  };

  const claims: CognitoUserClaims = { sub: 'test-sub' };

  const nutritionalPlanRow = {
    planName: 'Plan personalizado',
    startDate: new Date('2026-09-27T00:00:00.000Z'),
    endDate: new Date('2026-12-27T00:00:00.000Z'),
  };

  beforeEach(() => {
    const currentUser = {
      resolve: jest.fn().mockResolvedValue({ id: 'user-1' }),
    };
    nutritionalPlanRepository = {
      getLatestDatedMainPlanWithProjectionByUserId: jest.fn(),
    };
    useCase = new GetMyLatestPlanProjectionUseCase(
      currentUser as unknown as CurrentUserResolver,
      nutritionalPlanRepository as unknown as NutritionalPlanRepository,
    );
  });

  it('devuelve el período del último plan del usuario del token y su proyección', async () => {
    nutritionalPlanRepository.getLatestDatedMainPlanWithProjectionByUserId.mockResolvedValue(
      {
        ...nutritionalPlanRow,
        plan: {
          orderId: 'order-1',
          projections: [
            {
              projectedStartDate: new Date('2026-09-27T00:00:00.000Z'),
              projectedEndDate: new Date('2026-12-27T00:00:00.000Z'),
              projectedWeight: 74,
              projectedBmi: 25.01,
              projectedBfKg: 11.6,
              projectedBfPercentage: 15.68,
              projectedMmKg: 32,
              projectedMmPercentage: 43.24,
            },
          ],
        },
      },
    );

    const result = await useCase.execute({ claims });

    expect(
      nutritionalPlanRepository.getLatestDatedMainPlanWithProjectionByUserId,
    ).toHaveBeenCalledWith('user-1');
    expect(result).toEqual({
      orderId: 'order-1',
      planName: 'Plan personalizado',
      startDate: '2026-09-27',
      endDate: '2026-12-27',
      projection: {
        projectedStartDate: '2026-09-27',
        projectedEndDate: '2026-12-27',
        weight: 74,
        bmi: 25.01,
        bfKg: 11.6,
        bfPercentage: 15.68,
        mmKg: 32,
        mmPercentage: 43.24,
      },
    });
  });

  it('plan sin proyección devuelve projection null', async () => {
    nutritionalPlanRepository.getLatestDatedMainPlanWithProjectionByUserId.mockResolvedValue(
      {
        ...nutritionalPlanRow,
        plan: { orderId: 'order-1', projections: [] },
      },
    );

    await expect(useCase.execute({ claims })).resolves.toMatchObject({
      projection: null,
    });
  });

  it('sin plan con período responde 404', async () => {
    nutritionalPlanRepository.getLatestDatedMainPlanWithProjectionByUserId.mockResolvedValue(
      null,
    );

    await expect(useCase.execute({ claims })).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
