import { MeasurementResultsEntity } from '../../entities/measurements.entity';
import {
  CreateMeasurementResultsDto,
  UpdateMeasurementResultsDto,
} from '../..';

export abstract class MeasurementResultsRepository {
  abstract createMeasurementResults(
    createMeasurementResultsDto: CreateMeasurementResultsDto,
  ): Promise<MeasurementResultsEntity>;
  abstract getMeasurementResultsById(
    id: string,
  ): Promise<MeasurementResultsEntity | null>;
  abstract updateMeasurementResultsById(
    id: string,
    updateMeasurementResultsDto: UpdateMeasurementResultsDto,
  ): Promise<MeasurementResultsEntity>;
  abstract deleteMeasurementResultsById(id: string): Promise<void>;
}
