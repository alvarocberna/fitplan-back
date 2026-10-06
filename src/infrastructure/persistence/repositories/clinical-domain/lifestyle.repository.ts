import { Injectable } from '@nestjs/common';
import { LifestyleRepository } from '../../../../domain/repositories/clinical-domain/lifestyle.repository';
import { LifestyleDatasource } from '../../../../domain/datasources/clinical-domain/lifestyle.datasource';
import { LifestyleEntity } from '../../../../domain/entities/anamnesis.entity';
import { CreateLifestyleDto, UpdateLifestyleDto } from '../../../../domain';

@Injectable()
export class LifestyleRepositoryImpl implements LifestyleRepository {
  constructor(private readonly datasource: LifestyleDatasource) {}

  createLifestyle(
    createLifestyleDto: CreateLifestyleDto,
  ): Promise<LifestyleEntity> {
    return this.datasource.createLifestyle(createLifestyleDto);
  }

  getLifestyleById(id: string): Promise<LifestyleEntity | null> {
    return this.datasource.getLifestyleById(id);
  }

  updateLifestyleById(
    id: string,
    updateLifestyleDto: UpdateLifestyleDto,
  ): Promise<LifestyleEntity> {
    return this.datasource.updateLifestyleById(id, updateLifestyleDto);
  }

  deleteLifestyleById(id: string): Promise<void> {
    return this.datasource.deleteLifestyleById(id);
  }
}
