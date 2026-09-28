import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { MeasurementBasicInput } from '../../../domain';
import { MeasurementLevel } from '../../../domain/entities/enums';
import { MeasurementsRepository } from '../../../domain/repositories/clinical-domain/measurements.repository';
import { CognitoUserClaims } from '../../../common/auth/cognito-user.decorator';
import { CurrentUserResolver } from '../../identity/current-user.resolver';
import { MeasurementDetailDto, UpdateMeasurementDtoImpl } from '../dto/measurement.dto';
import { toMeasurementDetail } from '../measurement.mapper';
import {
  assertValidMeasurementInput,
  storedValue,
  toBioimpedanceResults,
} from '../measurement-input';

// CU-CLI-06. Corrige una medición del usuario autenticado: fecha, peso, talla y, en una
// bioimpedancia, grasa y masa muscular. Se pueden editar todas las mediciones, también las tomadas
// en una consulta. Valida el resultado de combinar lo guardado con lo enviado. Inexistente o
// ajena -> 404 (R2).
@Injectable()
export class UpdateMyMeasurementUseCase {
  constructor(
    private readonly currentUser: CurrentUserResolver,
    private readonly measurementsRepository: MeasurementsRepository,
  ) {}

  async execute(input: {
    claims: CognitoUserClaims;
    measurementId: string;
    data: UpdateMeasurementDtoImpl;
  }): Promise<MeasurementDetailDto> {
    const { data } = input;
    const user = await this.currentUser.resolve(input.claims);
    const current = await this.measurementsRepository.getMeasurementDetailByIdAndPatientId(
      input.measurementId,
      user.id,
    );
    if (!current) throw new NotFoundException('Medición no encontrada');

    const currentBasic = current.basicMeasurements?.[0];
    const currentResults = current.measurementResults?.[0];
    const isBioimpedance = current.level === MeasurementLevel.BIOIMPEDANCE;

    const measuredAt = data.measuredAt ? new Date(data.measuredAt) : current.measuredAt;
    const weight = data.weight ?? currentBasic?.weight;
    const height = data.height ?? currentBasic?.height;

    assertValidMeasurementInput({
      level: current.level,
      measuredAt,
      // sin valores básicos guardados ni enviados no hay contra qué comparar los kg
      weight: weight ?? Number.POSITIVE_INFINITY,
      // en una bioimpedancia, lo no enviado se valida con lo guardado; en otros tipos, solo lo enviado
      bodyFat: data.bodyFat ?? (isBioimpedance ? storedValue(currentResults, 'bf') : undefined),
      muscleMass:
        data.muscleMass ?? (isBioimpedance ? storedValue(currentResults, 'mm') : undefined),
    });

    let basic: Partial<MeasurementBasicInput> | undefined;
    if (data.weight !== undefined || data.height !== undefined) {
      if (currentBasic) {
        basic = {
          ...(data.weight !== undefined && { weight: data.weight }),
          ...(data.height !== undefined && { height: data.height }),
        };
      } else if (weight != null && height != null) {
        basic = { weight, height };
      } else {
        // la medición no tenía valores básicos: se crean solo con peso y talla completos
        throw new BadRequestException('Se requieren peso y talla');
      }
    }

    await this.measurementsRepository.updateMeasurementWithDetails(current.id, {
      measuredAt: data.measuredAt ? measuredAt : undefined,
      basic,
      results:
        isBioimpedance && (data.bodyFat || data.muscleMass)
          ? toBioimpedanceResults(data.bodyFat, data.muscleMass)
          : undefined,
    });

    const updated = await this.measurementsRepository.getMeasurementDetailByIdAndPatientId(
      current.id,
      user.id,
    );
    return toMeasurementDetail(updated!);
  }
}
