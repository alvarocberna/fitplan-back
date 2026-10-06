import { Injectable } from '@nestjs/common';
import { ProjectionRepository } from '../../../../domain/repositories/clinical-domain/projection.repository';
import { ProjectionDatasource } from '../../../../domain/datasources/clinical-domain/projection.datasource';
import { ProjectionEntity } from '../../../../domain/entities/measurements.entity';
import { CreateProjectionDto, UpdateProjectionDto } from '../../../../domain';

@Injectable()
export class ProjectionRepositoryImpl implements ProjectionRepository {
  constructor(private readonly datasource: ProjectionDatasource) {}

  createProjection(
    createProjectionDto: CreateProjectionDto,
  ): Promise<ProjectionEntity> {
    return this.datasource.createProjection(createProjectionDto);
  }

  getProjectionById(id: string): Promise<ProjectionEntity | null> {
    return this.datasource.getProjectionById(id);
  }

  updateProjectionById(
    id: string,
    updateProjectionDto: UpdateProjectionDto,
  ): Promise<ProjectionEntity> {
    return this.datasource.updateProjectionById(id, updateProjectionDto);
  }

  deleteProjectionById(id: string): Promise<void> {
    return this.datasource.deleteProjectionById(id);
  }
}
