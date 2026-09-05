import { MeasurementsEntity } from '../../entities/measurements.entity';
import { CreateMeasurementsDto, UpdateMeasurementsDto } from '../..';

export abstract class MeasurementsRepository {
  abstract createMeasurements(
    createMeasurementsDto: CreateMeasurementsDto,
  ): Promise<MeasurementsEntity>;
  abstract getMeasurementsById(id: string): Promise<MeasurementsEntity | null>;
  abstract updateMeasurementsById(
    id: string,
    updateMeasurementsDto: UpdateMeasurementsDto,
  ): Promise<MeasurementsEntity>;
  abstract deleteMeasurementsById(id: string): Promise<void>;
}
