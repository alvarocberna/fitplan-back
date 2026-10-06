import { Injectable } from '@nestjs/common';
import { SupplementsRepository } from '../../../../domain/repositories/clinical-domain/supplements.repository';
import { SupplementsDatasource } from '../../../../domain/datasources/clinical-domain/supplements.datasource';
import { SupplementsEntity } from '../../../../domain/entities/anamnesis.entity';
import { CreateSupplementsDto, UpdateSupplementsDto } from '../../../../domain';

@Injectable()
export class SupplementsRepositoryImpl implements SupplementsRepository {
  constructor(private readonly datasource: SupplementsDatasource) {}

  createSupplements(
    createSupplementsDto: CreateSupplementsDto,
  ): Promise<SupplementsEntity> {
    return this.datasource.createSupplements(createSupplementsDto);
  }

  getSupplementsById(id: string): Promise<SupplementsEntity | null> {
    return this.datasource.getSupplementsById(id);
  }

  updateSupplementsById(
    id: string,
    updateSupplementsDto: UpdateSupplementsDto,
  ): Promise<SupplementsEntity> {
    return this.datasource.updateSupplementsById(id, updateSupplementsDto);
  }

  deleteSupplementsById(id: string): Promise<void> {
    return this.datasource.deleteSupplementsById(id);
  }
}
