import { Injectable, NotFoundException } from '@nestjs/common';
import { MeasurementsRepository } from '../../../domain/repositories/clinical-domain/measurements.repository';
import { CognitoUserClaims } from '../../../common/auth/cognito-user.decorator';
import { CurrentUserResolver } from '../../identity/current-user.resolver';
import { MeasurementDetailDto } from '../dto/measurement.dto';
import { toMeasurementDetail } from '../measurement.mapper';

// CU-CLI-04. Detalle de una medición del usuario autenticado: valores registrados y resultados
// guardados. Inexistente o ajena -> 404 (R2).
@Injectable()
export class GetMyMeasurementUseCase {
  constructor(
    private readonly currentUser: CurrentUserResolver,
    private readonly measurementsRepository: MeasurementsRepository,
  ) {}

  async execute(input: {
    claims: CognitoUserClaims;
    measurementId: string;
  }): Promise<MeasurementDetailDto> {
    const user = await this.currentUser.resolve(input.claims);
    const measurement =
      await this.measurementsRepository.getMeasurementDetailByIdAndPatientId(
        input.measurementId,
        user.id,
      );
    if (!measurement) throw new NotFoundException('Medición no encontrada');
    return toMeasurementDetail(measurement);
  }
}
