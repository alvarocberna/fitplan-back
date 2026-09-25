import { ProjectionEntity } from '../../entities/measurements.entity';
import { CreateProjectionDto, UpdateProjectionDto } from '../..';

export abstract class ProjectionDatasource {
  abstract createProjection(
    createProjectionDto: CreateProjectionDto,
  ): Promise<ProjectionEntity>;
  abstract getProjectionById(id: string): Promise<ProjectionEntity | null>;
  abstract updateProjectionById(
    id: string,
    updateProjectionDto: UpdateProjectionDto,
  ): Promise<ProjectionEntity>;
  abstract deleteProjectionById(id: string): Promise<void>;
}
