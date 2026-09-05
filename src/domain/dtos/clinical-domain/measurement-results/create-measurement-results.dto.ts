import { MeasurementResultsEntity } from '../../../entities/measurements.entity';

export type CreateMeasurementResultsDto = Omit<
  MeasurementResultsEntity,
  'id' | 'measurements'
>;
