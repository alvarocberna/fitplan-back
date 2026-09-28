import { Injectable } from '@nestjs/common';
import { MeasurementsRepository } from '../../../../domain/repositories/clinical-domain/measurements.repository';
import { MeasurementsDatasource } from '../../../../domain/datasources/clinical-domain/measurements.datasource';
import { MeasurementsEntity } from '../../../../domain/entities/measurements.entity';
import {
  CreateMeasurementsDto,
  CreateMeasurementWithDetailsDto,
  MeasurementsDateRange,
  UpdateMeasurementsDto,
  UpdateMeasurementWithDetailsDto,
} from '../../../../domain';

@Injectable()
export class MeasurementsRepositoryImpl implements MeasurementsRepository {
  constructor(private readonly datasource: MeasurementsDatasource) {}

  createMeasurements(
    createMeasurementsDto: CreateMeasurementsDto,
  ): Promise<MeasurementsEntity> {
    return this.datasource.createMeasurements(createMeasurementsDto);
  }

  getMeasurementsById(id: string): Promise<MeasurementsEntity | null> {
    return this.datasource.getMeasurementsById(id);
  }

  updateMeasurementsById(
    id: string,
    updateMeasurementsDto: UpdateMeasurementsDto,
  ): Promise<MeasurementsEntity> {
    return this.datasource.updateMeasurementsById(id, updateMeasurementsDto);
  }

  deleteMeasurementsById(id: string): Promise<void> {
    return this.datasource.deleteMeasurementsById(id);
  }

  getLatestMeasurementsWithResultsByPatientId(
    patientId: string,
  ): Promise<MeasurementsEntity | null> {
    return this.datasource.getLatestMeasurementsWithResultsByPatientId(
      patientId,
    );
  }

  listMeasurementsByPatientId(
    patientId: string,
    range?: MeasurementsDateRange,
  ): Promise<MeasurementsEntity[]> {
    return this.datasource.listMeasurementsByPatientId(patientId, range);
  }

  getMeasurementDetailByIdAndPatientId(
    id: string,
    patientId: string,
  ): Promise<MeasurementsEntity | null> {
    return this.datasource.getMeasurementDetailByIdAndPatientId(id, patientId);
  }

  getMaxMeasurementNumberByClinicalRecordId(
    clinicalRecordId: string,
  ): Promise<number> {
    return this.datasource.getMaxMeasurementNumberByClinicalRecordId(
      clinicalRecordId,
    );
  }

  createMeasurementWithDetails(
    dto: CreateMeasurementWithDetailsDto,
  ): Promise<MeasurementsEntity> {
    return this.datasource.createMeasurementWithDetails(dto);
  }

  updateMeasurementWithDetails(
    id: string,
    dto: UpdateMeasurementWithDetailsDto,
  ): Promise<void> {
    return this.datasource.updateMeasurementWithDetails(id, dto);
  }
}
