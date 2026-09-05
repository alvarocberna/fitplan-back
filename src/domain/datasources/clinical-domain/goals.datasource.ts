import { GoalsEntity } from '../../entities/anamnesis.entity';
import { CreateGoalsDto, UpdateGoalsDto } from '../..';

export abstract class GoalsDatasource {
  abstract createGoals(createGoalsDto: CreateGoalsDto): Promise<GoalsEntity>;
  abstract getGoalsById(id: string): Promise<GoalsEntity | null>;
  abstract updateGoalsById(
    id: string,
    updateGoalsDto: UpdateGoalsDto,
  ): Promise<GoalsEntity>;
  abstract deleteGoalsById(id: string): Promise<void>;
}
