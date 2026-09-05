import { Injectable } from '@nestjs/common';
import { MeasurementResultsRepository } from '../../../domain/repositories/clinical-domain/measurement-results.repository';
import { MeasurementResultsDatasource } from '../../../domain/datasources/clinical-domain/measurement-results.datasource';
import { MeasurementResultsEntity } from '../../../domain/entities/measurements.entity';
import {
  CreateMeasurementResultsDto,
  UpdateMeasurementResultsDto,
} from '../../../domain';

@Injectable()
export class MeasurementResultsRepositoryImpl
  implements MeasurementResultsRepository
{
  constructor(private readonly datasource: MeasurementResultsDatasource) {}

  createMeasurementResults(
    createMeasurementResultsDto: CreateMeasurementResultsDto,
  ): Promise<MeasurementResultsEntity> {
    return this.datasource.createMeasurementResults(
      createMeasurementResultsDto,
    );
  }

  getMeasurementResultsById(
    id: string,
  ): Promise<MeasurementResultsEntity | null> {
    return this.datasource.getMeasurementResultsById(id);
  }

  updateMeasurementResultsById(
    id: string,
    updateMeasurementResultsDto: UpdateMeasurementResultsDto,
  ): Promise<MeasurementResultsEntity> {
    return this.datasource.updateMeasurementResultsById(
      id,
      updateMeasurementResultsDto,
    );
  }

  deleteMeasurementResultsById(id: string): Promise<void> {
    return this.datasource.deleteMeasurementResultsById(id);
  }
}
