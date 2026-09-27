import { Injectable } from '@nestjs/common';
import { DietaryRecall24hRepository } from '../../../../domain/repositories/clinical-domain/dietary-recall-24h.repository';
import { DietaryRecall24hDatasource } from '../../../../domain/datasources/clinical-domain/dietary-recall-24h.datasource';
import { DietaryRecall24hEntity } from '../../../../domain/entities/anamnesis.entity';
import {
  CreateDietaryRecall24hDto,
  UpdateDietaryRecall24hDto,
} from '../../../../domain';

@Injectable()
export class DietaryRecall24hRepositoryImpl
  implements DietaryRecall24hRepository
{
  constructor(private readonly datasource: DietaryRecall24hDatasource) {}

  createDietaryRecall24h(
    createDietaryRecall24hDto: CreateDietaryRecall24hDto,
  ): Promise<DietaryRecall24hEntity> {
    return this.datasource.createDietaryRecall24h(createDietaryRecall24hDto);
  }

  getDietaryRecall24hById(id: string): Promise<DietaryRecall24hEntity | null> {
    return this.datasource.getDietaryRecall24hById(id);
  }

  updateDietaryRecall24hById(
    id: string,
    updateDietaryRecall24hDto: UpdateDietaryRecall24hDto,
  ): Promise<DietaryRecall24hEntity> {
    return this.datasource.updateDietaryRecall24hById(
      id,
      updateDietaryRecall24hDto,
    );
  }

  deleteDietaryRecall24hById(id: string): Promise<void> {
    return this.datasource.deleteDietaryRecall24hById(id);
  }
}
