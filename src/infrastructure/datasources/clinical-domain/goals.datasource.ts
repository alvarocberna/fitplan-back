import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../orm/prisma/prisma.service';
import { GoalsDatasource } from '../../../domain/datasources/clinical-domain/goals.datasource';
import { GoalsEntity } from '../../../domain/entities/anamnesis.entity';
import { CreateGoalsDto, UpdateGoalsDto } from '../../../domain';

@Injectable()
export class GoalsDatasourceImpl implements GoalsDatasource {
  constructor(private readonly prisma: PrismaService) {}

  async createGoals(createGoalsDto: CreateGoalsDto): Promise<GoalsEntity> {
    return this.prisma.goals.create({ data: createGoalsDto });
  }

  async getGoalsById(id: string): Promise<GoalsEntity | null> {
    return this.prisma.goals.findUnique({ where: { id } });
  }

  async updateGoalsById(
    id: string,
    updateGoalsDto: UpdateGoalsDto,
  ): Promise<GoalsEntity> {
    return this.prisma.goals.update({ where: { id }, data: updateGoalsDto });
  }

  async deleteGoalsById(id: string): Promise<void> {
    await this.prisma.goals.delete({ where: { id } });
  }
}
