import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../orm/prisma/prisma.service';
import { DiametersDatasource } from '../../../domain/datasources/clinical-domain/diameters.datasource';
import { DiametersEntity } from '../../../domain/entities/measurements.entity';
import { CreateDiametersDto, UpdateDiametersDto } from '../../../domain';

@Injectable()
export class DiametersDatasourceImpl implements DiametersDatasource {
  constructor(private readonly prisma: PrismaService) {}

  async createDiameters(
    createDiametersDto: CreateDiametersDto,
  ): Promise<DiametersEntity> {
    return this.prisma.diameters.create({ data: createDiametersDto });
  }

  async getDiametersById(id: string): Promise<DiametersEntity | null> {
    return this.prisma.diameters.findUnique({ where: { id } });
  }

  async updateDiametersById(
    id: string,
    updateDiametersDto: UpdateDiametersDto,
  ): Promise<DiametersEntity> {
    return this.prisma.diameters.update({
      where: { id },
      data: updateDiametersDto,
    });
  }

  async deleteDiametersById(id: string): Promise<void> {
    await this.prisma.diameters.delete({ where: { id } });
  }
}
