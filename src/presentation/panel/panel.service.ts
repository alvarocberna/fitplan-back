import { Injectable } from '@nestjs/common';
import { calculateAge } from '../../domain';
import { AuthIdentityService } from '../auth/auth-identity.service';
import { CognitoUserClaims } from '../auth/cognito-user.decorator';
import { NutritionalConsultationRepository } from '../../domain/repositories/clinical-domain/nutritional-consultation.repository';
import { PanelSummaryDto } from './dto/panel-summary.dto';

@Injectable()
export class PanelService {
  constructor(
    private readonly authIdentityService: AuthIdentityService,
    private readonly nutritionalConsultationRepository: NutritionalConsultationRepository,
  ) {}

  // Trae el resumen del panel a partir de la última NutritionalConsultation del paciente que ya
  // tiene un plan generado (con patient, anamneses.goals y nutritionalPlans anidados) en vez de
  // consultar User/Goals/NutritionalPlan por separado.
  async getSummary(claims: CognitoUserClaims): Promise<PanelSummaryDto> {
    const user = await this.authIdentityService.getUserBySub(claims);

    const consultation =
      await this.nutritionalConsultationRepository.getLatestNutritionalConsultationWithDetailsByPatientId(
        user.id,
      );

    const goal = consultation?.anamneses?.[0]?.goals?.[0]?.mainGoal ?? null;
    const plan = consultation?.nutritionalPlans?.[0] ?? null;

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
