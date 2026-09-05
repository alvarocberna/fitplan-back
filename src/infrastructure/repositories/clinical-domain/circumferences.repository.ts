import { Injectable } from '@nestjs/common';
import { CircumferencesRepository } from '../../../domain/repositories/clinical-domain/circumferences.repository';
import { CircumferencesDatasource } from '../../../domain/datasources/clinical-domain/circumferences.datasource';
import { CircumferencesEntity } from '../../../domain/entities/measurements.entity';
import {
  CreateCircumferencesDto,
  UpdateCircumferencesDto,
} from '../../../domain';

@Injectable()
export class CircumferencesRepositoryImpl implements CircumferencesRepository {
  constructor(private readonly datasource: CircumferencesDatasource) {}

  createCircumferences(
    createCircumferencesDto: CreateCircumferencesDto,
  ): Promise<CircumferencesEntity> {
    return this.datasource.createCircumferences(createCircumferencesDto);
  }

  getCircumferencesById(id: string): Promise<CircumferencesEntity | null> {
    return this.datasource.getCircumferencesById(id);
  }

  updateCircumferencesById(
    id: string,
    updateCircumferencesDto: UpdateCircumferencesDto,
  ): Promise<CircumferencesEntity> {
    return this.datasource.updateCircumferencesById(
      id,
      updateCircumferencesDto,
    );
  }

  deleteCircumferencesById(id: string): Promise<void> {
    return this.datasource.deleteCircumferencesById(id);
  }
}
