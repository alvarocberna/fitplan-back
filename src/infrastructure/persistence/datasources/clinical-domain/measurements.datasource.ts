import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../orm/prisma/prisma.service';
import { MeasurementsDatasource } from '../../../../domain/datasources/clinical-domain/measurements.datasource';
import { MeasurementsEntity } from '../../../../domain/entities/measurements.entity';
import { CreateMeasurementsDto, UpdateMeasurementsDto } from '../../../../domain';

@Injectable()
export class MeasurementsDatasourceImpl implements MeasurementsDatasource {
  constructor(private readonly prisma: PrismaService) {}

  async createMeasurements(
    createMeasurementsDto: CreateMeasurementsDto,
  ): Promise<MeasurementsEntity> {
    return this.prisma.measurements.create({ data: createMeasurementsDto });
  }

  async getMeasurementsById(id: string): Promise<MeasurementsEntity | null> {
    return this.prisma.measurements.findUnique({ where: { id } });
  }

  async updateMeasurementsById(
    id: string,
    updateMeasurementsDto: UpdateMeasurementsDto,
  ): Promise<MeasurementsEntity> {
    return this.prisma.measurements.update({
      where: { id },
      data: updateMeasurementsDto,
    });
  }

  async deleteMeasurementsById(id: string): Promise<void> {
    await this.prisma.measurements.delete({ where: { id } });
  }
}
