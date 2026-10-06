import { Injectable } from '@nestjs/common';
import { NutritionalConsultationEntity } from '../../../domain/entities/clinical-record.entity';
import { NutritionalConsultationRepository } from '../../../domain/repositories/clinical-domain/nutritional-consultation.repository';
import { CognitoUserClaims } from '../../../common/auth/cognito-user.decorator';
import { CurrentUserResolver } from '../../identity/current-user.resolver';
import { ConsultationSummaryDto } from '../dto/consultation-summary.dto';
import { toPlanStatus } from '../plan-status';

// CU-CLI-01. Consultas nutricionales del usuario autenticado, más reciente primero, con el estado
// de su plan. Incluye las no pagadas (el frontend ofrece retomar el pago). Sin consultas -> [].
@Injectable()
export class ListMyConsultationsUseCase {
  constructor(
    private readonly currentUser: CurrentUserResolver,
    private readonly nutritionalConsultationRepository: NutritionalConsultationRepository,
  ) {}

  async execute(input: {
    claims: CognitoUserClaims;
  }): Promise<ConsultationSummaryDto[]> {
    const user = await this.currentUser.resolve(input.claims);
    const consultations =
      await this.nutritionalConsultationRepository.getNutritionalConsultationsWithStatusByPatientId(
        user.id,
      );
    return consultations.map(toConsultationSummary);
  }
}

function toConsultationSummary(
  consultation: NutritionalConsultationEntity,
): ConsultationSummaryDto {
  const plan = consultation.plans?.[0]?.nutritionalPlans?.[0] ?? null;
  return {
    consultationId: consultation.id,
    consultationNumber: consultation.consultationNumber,
    consultationDate: consultation.consultationDate.toISOString(),
    mainGoal: consultation.anamneses?.[0]?.goals?.[0]?.mainGoal ?? null,
    planStatus: toPlanStatus(consultation.order),
    orderId: consultation.orderId,
    plan: plan
      ? {
          planName: plan.planName,
          goal: plan.goal,
          dietRegimen: plan.dietRegimen,
          calorieIntake: plan.calorieIntake,
          proteinIntake: plan.proteinIntake,
          carbohydrateIntake: plan.carbohydrateIntake,
          lipidIntake: plan.lipidIntake,
        }
      : null,
  };
}
