import { MeasurementsEntity } from '../../../entities/measurements.entity';

export type CreateMeasurementsDto = Omit<
  MeasurementsEntity,
  | 'id'
  | 'consultation'
  | 'basicMeasurements'
  | 'skinfolds'
  | 'circumferences'
  | 'diameters'
  | 'measurementResults'
>;
