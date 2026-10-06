import { Controller, Get, Param, ParseUUIDPipe, UseGuards } from '@nestjs/common';
import { CognitoAuthGuard } from '../../common/auth/cognito-auth.guard';
import { CognitoUser } from '../../common/auth/cognito-user.decorator';
import type { CognitoUserClaims } from '../../common/auth/cognito-user.decorator';
import { MyLatestPlanProjectionDto, MyPlanDetailDto, MyPlanSummaryDto } from './dto/my-plan.dto';
import { ListMyPlansUseCase } from './use-cases/list-my-plans.use-case';
import { GetMyPlanUseCase } from './use-cases/get-my-plan.use-case';
import { GetMyLatestPlanProjectionUseCase } from './use-cases/get-my-latest-plan-projection.use-case';

@UseGuards(CognitoAuthGuard)
@Controller('me/plans')
export class MyPlansController {
  constructor(
    private readonly listMyPlans: ListMyPlansUseCase,
    private readonly getMyPlan: GetMyPlanUseCase,
    private readonly getMyLatestPlanProjection: GetMyLatestPlanProjectionUseCase,
  ) {}

  @Get()
  list(@CognitoUser() claims: CognitoUserClaims): Promise<MyPlanSummaryDto[]> {
    return this.listMyPlans.execute({ claims });
  }

  // Antes de :orderId por claridad (igual no chocan: son dos segmentos).
  @Get('latest/projection')
  latestProjection(
    @CognitoUser() claims: CognitoUserClaims,
  ): Promise<MyLatestPlanProjectionDto> {
    return this.getMyLatestPlanProjection.execute({ claims });
  }

  @Get(':orderId')
  getOne(
    @CognitoUser() claims: CognitoUserClaims,
    @Param('orderId', new ParseUUIDPipe({ version: '4' })) orderId: string,
  ): Promise<MyPlanDetailDto> {
    return this.getMyPlan.execute({ claims, orderId });
  }
}
