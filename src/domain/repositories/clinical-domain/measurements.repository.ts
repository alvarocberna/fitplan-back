import { MeasurementsEntity } from '../../entities/measurements.entity';
import {
  CreateMeasurementsDto,
  CreateMeasurementWithDetailsDto,
  MeasurementsDateRange,
  UpdateMeasurementsDto,
  UpdateMeasurementWithDetailsDto,
} from '../..';

export abstract class MeasurementsRepository {
  abstract createMeasurements(
    createMeasurementsDto: CreateMeasurementsDto,
  ): Promise<MeasurementsEntity>;
  abstract getMeasurementsById(id: string): Promise<MeasurementsEntity | null>;
  abstract updateMeasurementsById(
    id: string,
    updateMeasurementsDto: UpdateMeasurementsDto,
  ): Promise<MeasurementsEntity>;
  abstract deleteMeasurementsById(id: string): Promise<void>;
  abstract getLatestMeasurementsWithResultsByPatientId(
    patientId: string,
  ): Promise<MeasurementsEntity | null>;
  // Todas las mediciones del historial del paciente (ambos orígenes), más reciente primero, con
  // basicMeasurements, measurementResults y el número de su consulta (si tiene) — CU-CLI-03.
  abstract listMeasurementsByPatientId(
    patientId: string,
    range?: MeasurementsDateRange,
  ): Promise<MeasurementsEntity[]>;
  // Medición con todas sus hijas SOLO si pertenece al historial del paciente (R2: null si no existe
  // o no es suya) — CU-CLI-04/05/06.
  abstract getMeasurementDetailByIdAndPatientId(
    id: string,
    patientId: string,
  ): Promise<MeasurementsEntity | null>;
  // Mayor measurement_number del historial (0 si no tiene mediciones) — CU-CLI-05.
  abstract getMaxMeasurementNumberByClinicalRecordId(
    clinicalRecordId: string,
  ): Promise<number>;
  // Crea la medición (sin consulta) con basic_measurements y, si vienen, measurement_results.
  abstract createMeasurementWithDetails(
    dto: CreateMeasurementWithDetailsDto,
  ): Promise<MeasurementsEntity>;
  // Actualiza la medición y sus hijas (basic/results) en una transacción.
  abstract updateMeasurementWithDetails(
    id: string,
    dto: UpdateMeasurementWithDetailsDto,
  ): Promise<void>;
}
