import { Injectable } from '@nestjs/common';
import { AnamnesisDietaryRepository } from '../../../domain/repositories/clinical-domain/anamnesis-dietary.repository';
import { AnamnesisDietaryDatasource } from '../../../domain/datasources/clinical-domain/anamnesis-dietary.datasource';
import { AnamnesisDietaryEntity } from '../../../domain/entities/anamnesis.entity';
import {
  CreateAnamnesisDietaryDto,
  UpdateAnamnesisDietaryDto,
} from '../../../domain';

@Injectable()
export class AnamnesisDietaryRepositoryImpl
  implements AnamnesisDietaryRepository
{
  constructor(private readonly datasource: AnamnesisDietaryDatasource) {}

  createAnamnesisDietary(
    createAnamnesisDietaryDto: CreateAnamnesisDietaryDto,
  ): Promise<AnamnesisDietaryEntity> {
    return this.datasource.createAnamnesisDietary(createAnamnesisDietaryDto);
  }

  getAnamnesisDietaryById(id: string): Promise<AnamnesisDietaryEntity | null> {
    return this.datasource.getAnamnesisDietaryById(id);
  }

  updateAnamnesisDietaryById(
    id: string,
    updateAnamnesisDietaryDto: UpdateAnamnesisDietaryDto,
  ): Promise<AnamnesisDietaryEntity> {
    return this.datasource.updateAnamnesisDietaryById(
      id,
      updateAnamnesisDietaryDto,
    );
  }

  deleteAnamnesisDietaryById(id: string): Promise<void> {
    return this.datasource.deleteAnamnesisDietaryById(id);
  }
}
