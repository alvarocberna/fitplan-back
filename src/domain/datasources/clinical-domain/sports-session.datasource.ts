import { SportsSessionEntity } from '../../entities/anamnesis.entity';
import { CreateSportsSessionDto, UpdateSportsSessionDto } from '../..';

export abstract class SportsSessionDatasource {
  abstract createSportsSession(
    createSportsSessionDto: CreateSportsSessionDto,
  ): Promise<SportsSessionEntity>;
  abstract getSportsSessionById(
    id: string,
  ): Promise<SportsSessionEntity | null>;
  abstract updateSportsSessionById(
    id: string,
    updateSportsSessionDto: UpdateSportsSessionDto,
  ): Promise<SportsSessionEntity>;
  abstract deleteSportsSessionById(id: string): Promise<void>;
}
