import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  calculateMeasurementResults,
  MeasurementBasicInput,
  MeasurementResultsInput,
} from '../../../domain';
import { MeasurementLevel } from '../../../domain/entities/enums';
import { MeasurementsRepository } from '../../../domain/repositories/clinical-domain/measurements.repository';
import { CognitoUserClaims } from '../../../common/auth/cognito-user.decorator';
import { CurrentUserResolver } from '../../identity/current-user.resolver';
import { MeasurementDetailDto, UpdateMeasurementDtoImpl } from '../dto/measurement.dto';
import { toMeasurementDetail } from '../measurement.mapper';
import { assertValidMeasurementInput, storedValue } from '../measurement-input';

// CU-CLI-06. Corrige una medición del usuario autenticado: fecha, peso, talla y, en una
// bioimpedancia, grasa corporal, masa muscular, grasa visceral y masa ósea. Se pueden editar todas
// las mediciones, también las tomadas en una consulta. Valida y recalcula measurement_results con el
// resultado de combinar lo guardado con lo enviado: de lo no enviado se toma el % guardado (fuente
// de verdad), así que si cambia solo el peso se mantienen los % y se recalculan los kg y el IMC.
// Inexistente o ajena -> 404 (R2).
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

    // En una bioimpedancia, lo no enviado se toma de lo guardado (null en un opcional lo quita); en
    // otros tipos, solo lo enviado (para rechazarlo).
    const components = isBioimpedance
      ? {
          bodyFat: data.bodyFat ?? storedValue(currentResults, 'bf'),
          muscleMass: data.muscleMass ?? storedValue(currentResults, 'mm'),
          visceralFat:
            data.visceralFat === null
              ? undefined
              : (data.visceralFat ?? storedValue(currentResults, 'vf')),
          boneMass:
            data.boneMass === null
              ? undefined
              : (data.boneMass ?? storedValue(currentResults, 'bm')),
        }
      : {
          bodyFat: data.bodyFat,
          muscleMass: data.muscleMass,
          visceralFat: data.visceralFat ?? undefined,
          boneMass: data.boneMass ?? undefined,
        };

    assertValidMeasurementInput({
      level: current.level,
      measuredAt,
      // sin valores básicos guardados ni enviados no hay contra qué comparar los kg
      weight: weight ?? Number.POSITIVE_INFINITY,
      ...components,
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

    // Se recalcula todo si cambia algo de lo que dependen los resultados.
    const affectsResults = [
      data.weight,
      data.height,
      data.bodyFat,
      data.muscleMass,
      data.visceralFat,
      data.boneMass,
    ].some((value) => value !== undefined);
    let results: MeasurementResultsInput | undefined;
    if (affectsResults) {
      const calculated = calculateMeasurementResults({
        level: current.level,
        weight,
        height,
        ...components,
      });
      results = Object.keys(calculated).length > 0 ? calculated : undefined;
    }

    await this.measurementsRepository.updateMeasurementWithDetails(current.id, {
      measuredAt: data.measuredAt ? measuredAt : undefined,
      basic,
      results,
    });

    const updated = await this.measurementsRepository.getMeasurementDetailByIdAndPatientId(
      current.id,
      user.id,
    );
    return toMeasurementDetail(updated!);
  }
}
