import { BasicMeasurementsEntity } from '../../entities/measurements.entity';
import { CreateBasicMeasurementsDto, UpdateBasicMeasurementsDto } from '../..';

export abstract class BasicMeasurementsRepository {
  abstract createBasicMeasurements(
    createBasicMeasurementsDto: CreateBasicMeasurementsDto,
  ): Promise<BasicMeasurementsEntity>;
  abstract getBasicMeasurementsById(
    id: string,
  ): Promise<BasicMeasurementsEntity | null>;
  abstract updateBasicMeasurementsById(
    id: string,
    updateBasicMeasurementsDto: UpdateBasicMeasurementsDto,
  ): Promise<BasicMeasurementsEntity>;
  abstract deleteBasicMeasurementsById(id: string): Promise<void>;
}
