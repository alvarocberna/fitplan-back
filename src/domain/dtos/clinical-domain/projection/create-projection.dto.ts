import { ProjectionEntity } from '../../../entities/measurements.entity';

export type CreateProjectionDto = Omit<ProjectionEntity, 'id' | 'plan'>;
