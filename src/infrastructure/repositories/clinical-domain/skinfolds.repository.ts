import { Injectable } from '@nestjs/common';
import { SkinfoldsRepository } from '../../../domain/repositories/clinical-domain/skinfolds.repository';
import { SkinfoldsDatasource } from '../../../domain/datasources/clinical-domain/skinfolds.datasource';
import { SkinfoldsEntity } from '../../../domain/entities/measurements.entity';
import { CreateSkinfoldsDto, UpdateSkinfoldsDto } from '../../../domain';

@Injectable()
export class SkinfoldsRepositoryImpl implements SkinfoldsRepository {
  constructor(private readonly datasource: SkinfoldsDatasource) {}

  createSkinfolds(
    createSkinfoldsDto: CreateSkinfoldsDto,
  ): Promise<SkinfoldsEntity> {
    return this.datasource.createSkinfolds(createSkinfoldsDto);
  }

  getSkinfoldsById(id: string): Promise<SkinfoldsEntity | null> {
    return this.datasource.getSkinfoldsById(id);
  }

  updateSkinfoldsById(
    id: string,
    updateSkinfoldsDto: UpdateSkinfoldsDto,
  ): Promise<SkinfoldsEntity> {
    return this.datasource.updateSkinfoldsById(id, updateSkinfoldsDto);
  }

  deleteSkinfoldsById(id: string): Promise<void> {
    return this.datasource.deleteSkinfoldsById(id);
  }
}
