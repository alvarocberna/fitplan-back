import { Injectable } from '@nestjs/common';
import { SportsSessionRepository } from '../../../../domain/repositories/clinical-domain/sports-session.repository';
import { SportsSessionDatasource } from '../../../../domain/datasources/clinical-domain/sports-session.datasource';
import { SportsSessionEntity } from '../../../../domain/entities/anamnesis.entity';
import {
  CreateSportsSessionDto,
  UpdateSportsSessionDto,
} from '../../../../domain';

@Injectable()
export class SportsSessionRepositoryImpl implements SportsSessionRepository {
  constructor(private readonly datasource: SportsSessionDatasource) {}

  createSportsSession(
    createSportsSessionDto: CreateSportsSessionDto,
  ): Promise<SportsSessionEntity> {
    return this.datasource.createSportsSession(createSportsSessionDto);
  }

  getSportsSessionById(id: string): Promise<SportsSessionEntity | null> {
    return this.datasource.getSportsSessionById(id);
  }

  updateSportsSessionById(
    id: string,
    updateSportsSessionDto: UpdateSportsSessionDto,
  ): Promise<SportsSessionEntity> {
    return this.datasource.updateSportsSessionById(id, updateSportsSessionDto);
  }

  deleteSportsSessionById(id: string): Promise<void> {
    return this.datasource.deleteSportsSessionById(id);
  }
}
