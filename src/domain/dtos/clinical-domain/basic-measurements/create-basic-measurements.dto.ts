import { BasicMeasurementsEntity } from '../../../entities/measurements.entity';

export type CreateBasicMeasurementsDto = Omit<
  BasicMeasurementsEntity,
  'id' | 'measurements'
>;
