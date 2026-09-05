import { Injectable } from '@nestjs/common';
import { BasicMeasurementsRepository } from '../../../domain/repositories/clinical-domain/basic-measurements.repository';
import { BasicMeasurementsDatasource } from '../../../domain/datasources/clinical-domain/basic-measurements.datasource';
import { BasicMeasurementsEntity } from '../../../domain/entities/measurements.entity';
import {
  CreateBasicMeasurementsDto,
  UpdateBasicMeasurementsDto,
} from '../../../domain';

@Injectable()
export class BasicMeasurementsRepositoryImpl
  implements BasicMeasurementsRepository
{
  constructor(private readonly datasource: BasicMeasurementsDatasource) {}

  createBasicMeasurements(
    createBasicMeasurementsDto: CreateBasicMeasurementsDto,
  ): Promise<BasicMeasurementsEntity> {
    return this.datasource.createBasicMeasurements(createBasicMeasurementsDto);
  }

  getBasicMeasurementsById(
    id: string,
  ): Promise<BasicMeasurementsEntity | null> {
    return this.datasource.getBasicMeasurementsById(id);
  }

  updateBasicMeasurementsById(
    id: string,
    updateBasicMeasurementsDto: UpdateBasicMeasurementsDto,
  ): Promise<BasicMeasurementsEntity> {
    return this.datasource.updateBasicMeasurementsById(
      id,
      updateBasicMeasurementsDto,
    );
  }

  deleteBasicMeasurementsById(id: string): Promise<void> {
    return this.datasource.deleteBasicMeasurementsById(id);
  }
}
