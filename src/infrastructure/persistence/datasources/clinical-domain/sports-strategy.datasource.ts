import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../orm/prisma/prisma.service';
import { SportsStrategyDatasource } from '../../../../domain/datasources/clinical-domain/sports-strategy.datasource';
import { SportsStrategyEntity } from '../../../../domain/entities/anamnesis.entity';
import {
  CreateSportsStrategyDto,
  UpdateSportsStrategyDto,
} from '../../../../domain';

@Injectable()
export class SportsStrategyDatasourceImpl implements SportsStrategyDatasource {
  constructor(private readonly prisma: PrismaService) {}

  async createSportsStrategy(
    createSportsStrategyDto: CreateSportsStrategyDto,
  ): Promise<SportsStrategyEntity> {
    return this.prisma.sportsStrategy.create({ data: createSportsStrategyDto });
  }

  async getSportsStrategyById(
    id: string,
  ): Promise<SportsStrategyEntity | null> {
    return this.prisma.sportsStrategy.findUnique({ where: { id } });
  }

  async updateSportsStrategyById(
    id: string,
    updateSportsStrategyDto: UpdateSportsStrategyDto,
  ): Promise<SportsStrategyEntity> {
    return this.prisma.sportsStrategy.update({
      where: { id },
      data: updateSportsStrategyDto,
    });
  }

  async deleteSportsStrategyById(id: string): Promise<void> {
    await this.prisma.sportsStrategy.delete({ where: { id } });
  }
}
