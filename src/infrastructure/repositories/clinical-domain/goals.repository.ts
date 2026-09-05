import { Injectable } from '@nestjs/common';
import { GoalsRepository } from '../../../domain/repositories/clinical-domain/goals.repository';
import { GoalsDatasource } from '../../../domain/datasources/clinical-domain/goals.datasource';
import { GoalsEntity } from '../../../domain/entities/anamnesis.entity';
import { CreateGoalsDto, UpdateGoalsDto } from '../../../domain';

@Injectable()
export class GoalsRepositoryImpl implements GoalsRepository {
  constructor(private readonly datasource: GoalsDatasource) {}

  createGoals(createGoalsDto: CreateGoalsDto): Promise<GoalsEntity> {
    return this.datasource.createGoals(createGoalsDto);
  }

  getGoalsById(id: string): Promise<GoalsEntity | null> {
    return this.datasource.getGoalsById(id);
  }

  updateGoalsById(
    id: string,
    updateGoalsDto: UpdateGoalsDto,
  ): Promise<GoalsEntity> {
    return this.datasource.updateGoalsById(id, updateGoalsDto);
  }

  deleteGoalsById(id: string): Promise<void> {
    return this.datasource.deleteGoalsById(id);
  }
}
