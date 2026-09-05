import { Injectable } from '@nestjs/common';
import { AnamnesisClinicalRepository } from '../../../domain/repositories/clinical-domain/anamnesis-clinical.repository';
import { AnamnesisClinicalDatasource } from '../../../domain/datasources/clinical-domain/anamnesis-clinical.datasource';
import { AnamnesisClinicalEntity } from '../../../domain/entities/anamnesis.entity';
import {
  CreateAnamnesisClinicalDto,
  UpdateAnamnesisClinicalDto,
} from '../../../domain';

@Injectable()
export class AnamnesisClinicalRepositoryImpl
  implements AnamnesisClinicalRepository
{
  constructor(private readonly datasource: AnamnesisClinicalDatasource) {}

  createAnamnesisClinical(
    createAnamnesisClinicalDto: CreateAnamnesisClinicalDto,
  ): Promise<AnamnesisClinicalEntity> {
    return this.datasource.createAnamnesisClinical(createAnamnesisClinicalDto);
  }

  getAnamnesisClinicalById(
    id: string,
  ): Promise<AnamnesisClinicalEntity | null> {
    return this.datasource.getAnamnesisClinicalById(id);
  }

  updateAnamnesisClinicalById(
    id: string,
    updateAnamnesisClinicalDto: UpdateAnamnesisClinicalDto,
  ): Promise<AnamnesisClinicalEntity> {
    return this.datasource.updateAnamnesisClinicalById(
      id,
      updateAnamnesisClinicalDto,
    );
  }

  deleteAnamnesisClinicalById(id: string): Promise<void> {
    return this.datasource.deleteAnamnesisClinicalById(id);
  }
}
