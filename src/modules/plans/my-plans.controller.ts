import { Controller, Get, UseGuards } from '@nestjs/common';
import { OrderSummaryDto } from '../../domain';
import { CognitoAuthGuard } from '../../common/auth/cognito-auth.guard';
import { CognitoUser } from '../../common/auth/cognito-user.decorator';
import type { CognitoUserClaims } from '../../common/auth/cognito-user.decorator';
import { ListMyPlansUseCase } from './use-cases/list-my-plans.use-case';

@UseGuards(CognitoAuthGuard)
@Controller('me/plans')
export class MyPlansController {
  constructor(private readonly listMyPlans: ListMyPlansUseCase) {}

  @Get()
  list(@CognitoUser() claims: CognitoUserClaims): Promise<OrderSummaryDto[]> {
    return this.listMyPlans.execute({ claims });
  }
}
