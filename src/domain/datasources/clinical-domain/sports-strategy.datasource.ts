import { SportsStrategyEntity } from '../../entities/anamnesis.entity';
import { CreateSportsStrategyDto, UpdateSportsStrategyDto } from '../..';

export abstract class SportsStrategyDatasource {
  abstract createSportsStrategy(
    createSportsStrategyDto: CreateSportsStrategyDto,
  ): Promise<SportsStrategyEntity>;
  abstract getSportsStrategyById(
    id: string,
  ): Promise<SportsStrategyEntity | null>;
  abstract updateSportsStrategyById(
    id: string,
    updateSportsStrategyDto: UpdateSportsStrategyDto,
  ): Promise<SportsStrategyEntity>;
  abstract deleteSportsStrategyById(id: string): Promise<void>;
}
