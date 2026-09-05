import { Injectable } from '@nestjs/common';
import { DiametersRepository } from '../../../domain/repositories/clinical-domain/diameters.repository';
import { DiametersDatasource } from '../../../domain/datasources/clinical-domain/diameters.datasource';
import { DiametersEntity } from '../../../domain/entities/measurements.entity';
import { CreateDiametersDto, UpdateDiametersDto } from '../../../domain';

@Injectable()
export class DiametersRepositoryImpl implements DiametersRepository {
  constructor(private readonly datasource: DiametersDatasource) {}

  createDiameters(
    createDiametersDto: CreateDiametersDto,
  ): Promise<DiametersEntity> {
    return this.datasource.createDiameters(createDiametersDto);
  }

  getDiametersById(id: string): Promise<DiametersEntity | null> {
    return this.datasource.getDiametersById(id);
  }

  updateDiametersById(
    id: string,
    updateDiametersDto: UpdateDiametersDto,
  ): Promise<DiametersEntity> {
    return this.datasource.updateDiametersById(id, updateDiametersDto);
  }

  deleteDiametersById(id: string): Promise<void> {
    return this.datasource.deleteDiametersById(id);
  }
}
