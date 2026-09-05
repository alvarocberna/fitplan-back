import { Injectable } from '@nestjs/common';
import { AnamnesisRepository } from '../../../domain/repositories/clinical-domain/anamnesis.repository';
import { AnamnesisDatasource } from '../../../domain/datasources/clinical-domain/anamnesis.datasource';
import { AnamnesisEntity } from '../../../domain/entities/anamnesis.entity';
import { CreateAnamnesisDto, UpdateAnamnesisDto } from '../../../domain';

@Injectable()
export class AnamnesisRepositoryImpl implements AnamnesisRepository {
  constructor(private readonly datasource: AnamnesisDatasource) {}

  createAnamnesis(
    createAnamnesisDto: CreateAnamnesisDto,
  ): Promise<AnamnesisEntity> {
    return this.datasource.createAnamnesis(createAnamnesisDto);
  }

  getAnamnesisById(id: string): Promise<AnamnesisEntity | null> {
    return this.datasource.getAnamnesisById(id);
  }

  updateAnamnesisById(
    id: string,
    updateAnamnesisDto: UpdateAnamnesisDto,
  ): Promise<AnamnesisEntity> {
    return this.datasource.updateAnamnesisById(id, updateAnamnesisDto);
  }

  deleteAnamnesisById(id: string): Promise<void> {
    return this.datasource.deleteAnamnesisById(id);
  }
}
