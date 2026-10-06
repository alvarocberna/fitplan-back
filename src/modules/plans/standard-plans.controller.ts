import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { PredefinedPlanPreviewDto, PredefinedProductDto } from '../../domain';
import { Throttle } from '@nestjs/throttler';
import { ORDER_THROTTLE } from '../../common/throttling/throttle-limits';
import { ParseProductCodePipe } from './product-code.pipe';
import { CognitoAuthGuard } from '../../common/auth/cognito-auth.guard';
import { CognitoUser } from '../../common/auth/cognito-user.decorator';
import type { CognitoUserClaims } from '../../common/auth/cognito-user.decorator';
import { ListStandardPlanPreviewsUseCase } from './use-cases/list-standard-plan-previews.use-case';
import { GetStandardPlanUseCase } from './use-cases/get-standard-plan.use-case';
import { PurchaseStandardPlanUseCase } from './use-cases/purchase-standard-plan.use-case';

// Catálogo de planes estándar (Product de tipo PREDEFINED). La lectura es pública a propósito (sin
// CognitoAuthGuard); la compra exige sesión.
@Controller('plans/standard')
export class StandardPlansController {
  constructor(
    private readonly listPreviews: ListStandardPlanPreviewsUseCase,
    private readonly getStandardPlan: GetStandardPlanUseCase,
    private readonly purchaseStandardPlan: PurchaseStandardPlanUseCase,
  ) {}

  // Declarada antes que ':code' para que 'previews' no se interprete como un código.
  @Get('previews')
  previews(): Promise<PredefinedPlanPreviewDto[]> {
    return this.listPreviews.execute();
  }

  @Get(':code')
  get(@Param('code', ParseProductCodePipe) code: string): Promise<PredefinedProductDto> {
    return this.getStandardPlan.execute({ code });
  }

  @UseGuards(CognitoAuthGuard)
  @Throttle(ORDER_THROTTLE)
  @Post(':code/purchase')
  purchase(
    @Param('code', ParseProductCodePipe) code: string,
    @CognitoUser() claims: CognitoUserClaims,
  ): Promise<{ orderId: string }> {
    return this.purchaseStandardPlan.execute({ claims, code });
  }
}
