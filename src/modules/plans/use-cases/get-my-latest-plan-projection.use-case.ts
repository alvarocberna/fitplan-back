import { Injectable, NotFoundException } from '@nestjs/common';
import { ProjectionEntity } from '../../../domain/entities/measurements.entity';
import { NutritionalPlanRepository } from '../../../domain/repositories/clinical-domain/nutritional-plan.repository';
import { CognitoUserClaims } from '../../../common/auth/cognito-user.decorator';
import { CurrentUserResolver } from '../../identity/current-user.resolver';
import { MyLatestPlanProjectionDto, MyPlanProjectionValuesDto } from '../dto/my-plan.dto';

// start_date/end_date/projected_* son columnas DATE: Prisma las entrega a medianoche UTC, así que
// se exponen como YYYY-MM-DD (sin hora, para que el front no las corra de día por zona horaria).
function dateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function projectionValuesOf(projection: ProjectionEntity): MyPlanProjectionValuesDto {
  return {
    projectedStartDate: dateOnly(projection.projectedStartDate),
    projectedEndDate: dateOnly(projection.projectedEndDate),
    weight: projection.projectedWeight,
    bmi: projection.projectedBmi,
    bfKg: projection.projectedBfKg,
    bfPercentage: projection.projectedBfPercentage,
    mmKg: projection.projectedMmKg,
    mmPercentage: projection.projectedMmPercentage,
  };
}

// CU-PLN-07. Período (inicio y término) del último plan del usuario autenticado que tiene fecha de
// término, con los valores que proyecta alcanzar. Alimenta el gráfico de evolución en modo "por
// plan". Sin plan con fechas -> 404.
@Injectable()
export class GetMyLatestPlanProjectionUseCase {
  constructor(
    private readonly currentUser: CurrentUserResolver,
    private readonly nutritionalPlanRepository: NutritionalPlanRepository,
  ) {}

  async execute(input: { claims: CognitoUserClaims }): Promise<MyLatestPlanProjectionDto> {
    const user = await this.currentUser.resolve(input.claims);
    const nutritionalPlan =
      await this.nutritionalPlanRepository.getLatestDatedMainPlanWithProjectionByUserId(user.id);
    if (!nutritionalPlan?.endDate || !nutritionalPlan.plan) {
      throw new NotFoundException('No hay un plan con período definido');
    }

    const projection = nutritionalPlan.plan.projections?.[0];
    return {
      orderId: nutritionalPlan.plan.orderId,
      planName: nutritionalPlan.planName,
      startDate: dateOnly(nutritionalPlan.startDate),
      endDate: dateOnly(nutritionalPlan.endDate),
      projection: projection ? projectionValuesOf(projection) : null,
    };
  }
}
