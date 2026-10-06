import { Injectable, NotFoundException } from '@nestjs/common';
import { NutritionalConsultationEntity } from '../../../domain/entities/clinical-record.entity';
import { MeasurementsEntity } from '../../../domain/entities/measurements.entity';
import { NutritionalConsultationRepository } from '../../../domain/repositories/clinical-domain/nutritional-consultation.repository';
import { FileStorage } from '../../../domain/ports';
import { CognitoUserClaims } from '../../../common/auth/cognito-user.decorator';
import { CurrentUserResolver } from '../../identity/current-user.resolver';
import { signPlanFiles } from '../../billing/order-files';
import {
  ConsultationDetailDto,
  ConsultationMeasurementDto,
} from '../dto/consultation-detail.dto';
import { toPlanStatus } from '../plan-status';

// CU-CLI-02. Detalle de solo lectura de una consulta del usuario autenticado: objetivos, mediciones
// tomadas en ella y resumen del plan (con la URL firmada de descarga del PDF, R4). Inexistente o
// ajena -> 404 (R2).
@Injectable()
export class GetMyConsultationUseCase {
  constructor(
    private readonly currentUser: CurrentUserResolver,
    private readonly nutritionalConsultationRepository: NutritionalConsultationRepository,
    private readonly fileStorage: FileStorage,
  ) {}

  async execute(input: {
    claims: CognitoUserClaims;
    consultationId: string;
  }): Promise<ConsultationDetailDto> {
    const user = await this.currentUser.resolve(input.claims);
    const consultation =
      await this.nutritionalConsultationRepository.getNutritionalConsultationDetailByIdAndPatientId(
        input.consultationId,
        user.id,
      );
    if (!consultation) throw new NotFoundException('Consulta no encontrada');

    // Solo el PDF: la miniatura no se usa en el detalle.
    const { pdfUrl } = consultation.order
      ? await signPlanFiles(this.fileStorage, {
          pdfKey: consultation.order.pdfKey,
          thumbnailKey: null,
          creationDate: consultation.order.creationDate,
        })
      : { pdfUrl: null };
    return toConsultationDetail(consultation, pdfUrl);
  }
}

function toConsultationDetail(
  consultation: NutritionalConsultationEntity,
  pdfUrl: string | null,
): ConsultationDetailDto {
  const goals = consultation.anamneses?.[0]?.goals?.[0];
  const planEntity = consultation.plans?.[0];
  const plan = planEntity?.nutritionalPlans?.[0] ?? null;
  return {
    consultationId: consultation.id,
    consultationNumber: consultation.consultationNumber,
    consultationDate: consultation.consultationDate.toISOString(),
    goals: {
      mainGoal: goals?.mainGoal ?? null,
      secondaryGoals: goals?.secondaryGoal ?? [],
    },
    planStatus: toPlanStatus(consultation.order),
    orderId: consultation.orderId,
    measurements: (consultation.measurements ?? []).map(toMeasurement),
    plan:
      plan && planEntity
        ? {
            orderId: planEntity.orderId,
            pdfUrl,
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

function toMeasurement(
  measurement: MeasurementsEntity,
): ConsultationMeasurementDto {
  const basic = measurement.basicMeasurements?.[0];
  const results = measurement.measurementResults?.[0];
  return {
    measurementId: measurement.id,
    measurementNumber: measurement.measurementNumber,
    measuredAt: measurement.measuredAt.toISOString(),
    level: measurement.level,
    basic: basic
      ? {
          weight: basic.weight,
          height: basic.height,
          sittingHeight: basic.sittingHeight,
          armSpan: basic.armSpan,
        }
      : null,
    results: results
      ? {
          bmi: results.bmi,
          bmiClassification: results.bmiClassification,
          bfPercentage: results.bfPercentage,
          bfClassification: results.bfClassification,
        }
      : null,
  };
}
