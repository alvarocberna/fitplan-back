import { MeasurementsEntity } from '../../entities/measurements.entity';
import { CreateMeasurementsDto, UpdateMeasurementsDto } from '../..';

export abstract class MeasurementsDatasource {
  abstract createMeasurements(
    createMeasurementsDto: CreateMeasurementsDto,
  ): Promise<MeasurementsEntity>;
  abstract getMeasurementsById(id: string): Promise<MeasurementsEntity | null>;
  abstract updateMeasurementsById(
    id: string,
    updateMeasurementsDto: UpdateMeasurementsDto,
  ): Promise<MeasurementsEntity>;
  abstract deleteMeasurementsById(id: string): Promise<void>;

  // Medición más reciente (por measuredAt) del historial clínico del paciente, sea de una consulta
  // o registrada por él, con basicMeasurements y measurementResults — usada por el resumen del
  // panel (GET /me/summary, modules/identity).
  abstract getLatestMeasurementsWithResultsByPatientId(
    patientId: string,
  ): Promise<MeasurementsEntity | null>;
}
