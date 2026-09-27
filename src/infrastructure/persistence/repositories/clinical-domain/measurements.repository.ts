import { Injectable } from '@nestjs/common';
import { MeasurementsRepository } from '../../../../domain/repositories/clinical-domain/measurements.repository';
import { MeasurementsDatasource } from '../../../../domain/datasources/clinical-domain/measurements.datasource';
import { MeasurementsEntity } from '../../../../domain/entities/measurements.entity';
import { CreateMeasurementsDto, UpdateMeasurementsDto } from '../../../../domain';

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
}
