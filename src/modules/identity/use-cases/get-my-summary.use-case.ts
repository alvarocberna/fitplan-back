import { Injectable } from '@nestjs/common';
import { calculateAge } from '../../../domain';
import { CurrentUserResolver } from '../current-user.resolver';
import { CognitoUserClaims } from '../../../common/auth/cognito-user.decorator';
import { NutritionalConsultationRepository } from '../../../domain/repositories/clinical-domain/nutritional-consultation.repository';
import { MeasurementsRepository } from '../../../domain/repositories/clinical-domain/measurements.repository';
import { MeasurementsEntity } from '../../../domain/entities/measurements.entity';
import { SummaryDto, SummaryLastMeasurementDto } from '../dto/summary.dto';

// CU-IDN-04.
@Injectable()
export class GetMySummaryUseCase {
  constructor(
    private readonly currentUser: CurrentUserResolver,
    private readonly nutritionalConsultationRepository: NutritionalConsultationRepository,
    private readonly measurementsRepository: MeasurementsRepository,
  ) {}

  // Trae el resumen del panel a partir de la última NutritionalConsultation del paciente que ya
  // tiene un plan generado (con patient, anamneses.goals y plans activos -> nutritionalPlan
  // principal anidados) en vez de consultar User/Goals/NutritionalPlan por separado, más la
  // última medición del historial clínico (cualquier origen).
  async execute({
    claims,
  }: {
    claims: CognitoUserClaims;
  }): Promise<SummaryDto> {
    const user = await this.currentUser.resolve(claims);

    const [consultation, measurement] = await Promise.all([
      this.nutritionalConsultationRepository.getLatestNutritionalConsultationWithDetailsByPatientId(
        user.id,
      ),
      this.measurementsRepository.getLatestMeasurementsWithResultsByPatientId(
        user.id,
      ),
    ]);

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
      lastMeasurement: measurement ? toLastMeasurement(measurement) : null,
    };
  }
}

function toLastMeasurement(
  measurement: MeasurementsEntity,
): SummaryLastMeasurementDto {
  const basic = measurement.basicMeasurements?.[0];
  const results = measurement.measurementResults?.[0];
  return {
    measuredAt: measurement.measuredAt.toISOString(),
    weight: basic?.weight ?? null,
    height: basic?.height ?? null,
    bmi: results?.bmi ?? null,
    bmiClassification: results?.bmiClassification ?? null,
    bfPercentage: results?.bfPercentage ?? null,
  };
}
