import { Injectable } from '@nestjs/common';
import { MeasurementLevel } from '../../../domain/entities/enums';
import { ClinicalRecordRepository } from '../../../domain/repositories/clinical-domain/clinical-record.repository';
import { MeasurementsRepository } from '../../../domain/repositories/clinical-domain/measurements.repository';
import { CognitoUserClaims } from '../../../common/auth/cognito-user.decorator';
import { CurrentUserResolver } from '../../identity/current-user.resolver';
import { MeasurementDetailDto, RecordMeasurementDtoImpl } from '../dto/measurement.dto';
import { toMeasurementDetail } from '../measurement.mapper';
import {
  assertValidMeasurementInput,
  toBioimpedanceResults,
} from '../measurement-input';

// CU-CLI-05. El usuario registra una medición por su cuenta (sin consulta: consultation_id = null)
// en su historial clínico (se crea si no existe), con el siguiente measurement_number del historial.
// measurement_results guarda solo lo ingresado (grasa y masa muscular de una bioimpedancia): el
// cálculo de IMC, conversiones y clasificaciones queda para las fórmulas (MeasurementResultsCalculator).
@Injectable()
export class RecordMeasurementUseCase {
  constructor(
    private readonly currentUser: CurrentUserResolver,
    private readonly clinicalRecordRepository: ClinicalRecordRepository,
    private readonly measurementsRepository: MeasurementsRepository,
  ) {}

  async execute(input: {
    claims: CognitoUserClaims;
    data: RecordMeasurementDtoImpl;
  }): Promise<MeasurementDetailDto> {
    const { data } = input;
    const measuredAt = data.measuredAt ? new Date(data.measuredAt) : new Date();
    assertValidMeasurementInput({
      level: data.level,
      measuredAt,
      weight: data.weight,
      bodyFat: data.bodyFat,
      muscleMass: data.muscleMass,
    });

    const user = await this.currentUser.resolve(input.claims);
    const clinicalRecord =
      await this.clinicalRecordRepository.findOrCreateClinicalRecordByPatientId(user.id);
    const lastNumber =
      await this.measurementsRepository.getMaxMeasurementNumberByClinicalRecordId(
        clinicalRecord.id,
      );

    const created = await this.measurementsRepository.createMeasurementWithDetails({
      clinicalRecordId: clinicalRecord.id,
      measuredAt,
      level: data.level,
      measurementNumber: lastNumber + 1,
      basic: { weight: data.weight, height: data.height },
      results:
        data.level === MeasurementLevel.BIOIMPEDANCE
          ? toBioimpedanceResults(data.bodyFat, data.muscleMass)
          : null,
    });

    // R6: devuelve lo creado, releído con todas sus hijas.
    const measurement = await this.measurementsRepository.getMeasurementDetailByIdAndPatientId(
      created.id,
      user.id,
    );
    return toMeasurementDetail(measurement!);
  }
}
