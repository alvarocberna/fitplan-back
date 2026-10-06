import { DiametersEntity } from '../../../entities/measurements.entity';

export type CreateDiametersDto = Omit<DiametersEntity, 'id' | 'measurements'>;
