import { MeasurementsEntity } from '../../../entities/measurements.entity';

export type CreateMeasurementsDto = Omit<
  MeasurementsEntity,
  | 'id'
  | 'clinicalRecord'
  | 'consultation'
  | 'basicMeasurements'
  | 'skinfolds'
  | 'circumferences'
  | 'diameters'
  | 'measurementResults'
>;
