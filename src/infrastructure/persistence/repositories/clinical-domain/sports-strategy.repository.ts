import { Injectable } from '@nestjs/common';
import { SportsStrategyRepository } from '../../../../domain/repositories/clinical-domain/sports-strategy.repository';
import { SportsStrategyDatasource } from '../../../../domain/datasources/clinical-domain/sports-strategy.datasource';
import { SportsStrategyEntity } from '../../../../domain/entities/anamnesis.entity';
import {
  CreateSportsStrategyDto,
  UpdateSportsStrategyDto,
} from '../../../../domain';

@Injectable()
export class SportsStrategyRepositoryImpl implements SportsStrategyRepository {
  constructor(private readonly datasource: SportsStrategyDatasource) {}

  createSportsStrategy(
    createSportsStrategyDto: CreateSportsStrategyDto,
  ): Promise<SportsStrategyEntity> {
    return this.datasource.createSportsStrategy(createSportsStrategyDto);
  }

  getSportsStrategyById(id: string): Promise<SportsStrategyEntity | null> {
    return this.datasource.getSportsStrategyById(id);
  }

  updateSportsStrategyById(
    id: string,
    updateSportsStrategyDto: UpdateSportsStrategyDto,
  ): Promise<SportsStrategyEntity> {
    return this.datasource.updateSportsStrategyById(
      id,
      updateSportsStrategyDto,
    );
  }

  deleteSportsStrategyById(id: string): Promise<void> {
    return this.datasource.deleteSportsStrategyById(id);
  }
}
