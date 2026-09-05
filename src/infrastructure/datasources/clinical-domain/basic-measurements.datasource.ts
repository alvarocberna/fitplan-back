import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../orm/prisma/prisma.service';
import { BasicMeasurementsDatasource } from '../../../domain/datasources/clinical-domain/basic-measurements.datasource';
import { BasicMeasurementsEntity } from '../../../domain/entities/measurements.entity';
import {
  CreateBasicMeasurementsDto,
  UpdateBasicMeasurementsDto,
} from '../../../domain';

@Injectable()
export class BasicMeasurementsDatasourceImpl
  implements BasicMeasurementsDatasource
{
  constructor(private readonly prisma: PrismaService) {}

  async createBasicMeasurements(
    createBasicMeasurementsDto: CreateBasicMeasurementsDto,
  ): Promise<BasicMeasurementsEntity> {
    return this.prisma.basicMeasurements.create({
      data: createBasicMeasurementsDto,
    });
  }

  async getBasicMeasurementsById(
    id: string,
  ): Promise<BasicMeasurementsEntity | null> {
    return this.prisma.basicMeasurements.findUnique({ where: { id } });
  }

  async updateBasicMeasurementsById(
    id: string,
    updateBasicMeasurementsDto: UpdateBasicMeasurementsDto,
  ): Promise<BasicMeasurementsEntity> {
    return this.prisma.basicMeasurements.update({
      where: { id },
      data: updateBasicMeasurementsDto,
    });
  }

  async deleteBasicMeasurementsById(id: string): Promise<void> {
    await this.prisma.basicMeasurements.delete({ where: { id } });
  }
}
