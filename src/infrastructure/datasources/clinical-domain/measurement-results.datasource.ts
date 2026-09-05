import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../orm/prisma/prisma.service';
import { MeasurementResultsDatasource } from '../../../domain/datasources/clinical-domain/measurement-results.datasource';
import { MeasurementResultsEntity } from '../../../domain/entities/measurements.entity';
import {
  CreateMeasurementResultsDto,
  UpdateMeasurementResultsDto,
} from '../../../domain';

@Injectable()
export class MeasurementResultsDatasourceImpl
  implements MeasurementResultsDatasource
{
  constructor(private readonly prisma: PrismaService) {}

  async createMeasurementResults(
    createMeasurementResultsDto: CreateMeasurementResultsDto,
  ): Promise<MeasurementResultsEntity> {
    return this.prisma.measurementResults.create({
      data: createMeasurementResultsDto,
    });
  }

  async getMeasurementResultsById(
    id: string,
  ): Promise<MeasurementResultsEntity | null> {
    return this.prisma.measurementResults.findUnique({ where: { id } });
  }

  async updateMeasurementResultsById(
    id: string,
    updateMeasurementResultsDto: UpdateMeasurementResultsDto,
  ): Promise<MeasurementResultsEntity> {
    return this.prisma.measurementResults.update({
      where: { id },
      data: updateMeasurementResultsDto,
    });
  }

  async deleteMeasurementResultsById(id: string): Promise<void> {
    await this.prisma.measurementResults.delete({ where: { id } });
  }
}
