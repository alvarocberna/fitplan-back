import { Injectable } from '@nestjs/common';
import { calculateAge } from '../../../domain';
import { CurrentUserResolver } from '../current-user.resolver';
import { CognitoUserClaims } from '../../../common/auth/cognito-user.decorator';
import { NutritionalConsultationRepository } from '../../../domain/repositories/clinical-domain/nutritional-consultation.repository';
import { SummaryDto } from '../dto/summary.dto';

// CU-IDN-04.
@Injectable()
export class GetMySummaryUseCase {
  constructor(
    private readonly currentUser: CurrentUserResolver,
    private readonly nutritionalConsultationRepository: NutritionalConsultationRepository,
  ) {}

  // Trae el resumen del panel a partir de la última NutritionalConsultation del paciente que ya
  // tiene un plan generado (con patient, anamneses.goals y plans activos -> nutritionalPlan
  // principal anidados) en vez de consultar User/Goals/NutritionalPlan por separado.
  async execute({ claims }: { claims: CognitoUserClaims }): Promise<SummaryDto> {
    const user = await this.currentUser.resolve(claims);

    const consultation =
      await this.nutritionalConsultationRepository.getLatestNutritionalConsultationWithDetailsByPatientId(
        user.id,
      );

    const goal = consultation?.anamneses?.[0]?.goals?.[0]?.mainGoal ?? null;
    const plan = consultation?.plans?.[0]?.nutritionalPlans?.[0] ?? null;

    return {
      firstName: user.firstName,
      middleName: user.middleName,
      paternalLastName: user.paternalLastName,
      maternalLastName: user.maternalLastName,
      age: user.dateOfBirth ? calculateAge(user.dateOfBirth) : null,
      lastConsultationDate:
        consultation?.consultationDate?.toISOString() ?? null,
      goal,
      nutritionalPlan: plan
        ? {
            dietRegimen: plan.dietRegimen,
            calorieIntake: plan.calorieIntake,
            proteinIntake: plan.proteinIntake,
            carbohydrateIntake: plan.carbohydrateIntake,
            lipidIntake: plan.lipidIntake,
          }
        : null,
    };
  }
}
