import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../orm/prisma/prisma.service';
import { ProjectionDatasource } from '../../../domain/datasources/clinical-domain/projection.datasource';
import { ProjectionEntity } from '../../../domain/entities/measurements.entity';
import { CreateProjectionDto, UpdateProjectionDto } from '../../../domain';

@Injectable()
export class ProjectionDatasourceImpl implements ProjectionDatasource {
  constructor(private readonly prisma: PrismaService) {}

  async createProjection(
    createProjectionDto: CreateProjectionDto,
  ): Promise<ProjectionEntity> {
    return this.prisma.projection.create({
      data: createProjectionDto,
    });
  }

  async getProjectionById(id: string): Promise<ProjectionEntity | null> {
    return this.prisma.projection.findUnique({ where: { id } });
  }

  async updateProjectionById(
    id: string,
    updateProjectionDto: UpdateProjectionDto,
  ): Promise<ProjectionEntity> {
    return this.prisma.projection.update({
      where: { id },
      data: updateProjectionDto,
    });
  }

  async deleteProjectionById(id: string): Promise<void> {
    await this.prisma.projection.delete({ where: { id } });
  }
}
