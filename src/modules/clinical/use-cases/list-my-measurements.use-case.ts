import { Injectable } from '@nestjs/common';
import { MeasurementsRepository } from '../../../domain/repositories/clinical-domain/measurements.repository';
import { CognitoUserClaims } from '../../../common/auth/cognito-user.decorator';
import { CurrentUserResolver } from '../../identity/current-user.resolver';
import { MeasurementSummaryDto } from '../dto/measurement.dto';
import { toMeasurementSummary } from '../measurement.mapper';

// CU-CLI-03. Mediciones del historial clínico del usuario autenticado (de consulta y registradas por
// él), más reciente primero, con filtro opcional por fecha. Sin historial -> [].
@Injectable()
export class ListMyMeasurementsUseCase {
  constructor(
    private readonly currentUser: CurrentUserResolver,
    private readonly measurementsRepository: MeasurementsRepository,
  ) {}

  async execute(input: {
    claims: CognitoUserClaims;
    from?: Date;
    to?: Date;
  }): Promise<MeasurementSummaryDto[]> {
    const user = await this.currentUser.resolve(input.claims);
    const measurements =
      await this.measurementsRepository.listMeasurementsByPatientId(user.id, {
        from: input.from,
        to: input.to,
      });
    return measurements.map(toMeasurementSummary);
  }
}
