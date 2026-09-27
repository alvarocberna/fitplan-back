import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../orm/prisma/prisma.service';
import { SportsSessionDatasource } from '../../../../domain/datasources/clinical-domain/sports-session.datasource';
import { SportsSessionEntity } from '../../../../domain/entities/anamnesis.entity';
import {
  CreateSportsSessionDto,
  UpdateSportsSessionDto,
} from '../../../../domain';

@Injectable()
export class SportsSessionDatasourceImpl implements SportsSessionDatasource {
  constructor(private readonly prisma: PrismaService) {}

  async createSportsSession(
    createSportsSessionDto: CreateSportsSessionDto,
  ): Promise<SportsSessionEntity> {
    return this.prisma.sportsSession.create({
      data: createSportsSessionDto,
    });
  }

  async getSportsSessionById(id: string): Promise<SportsSessionEntity | null> {
    return this.prisma.sportsSession.findUnique({
      where: { id },
    });
  }

  async updateSportsSessionById(
    id: string,
    updateSportsSessionDto: UpdateSportsSessionDto,
  ): Promise<SportsSessionEntity> {
    return this.prisma.sportsSession.update({
      where: { id },
      data: updateSportsSessionDto,
    });
  }

  async deleteSportsSessionById(id: string): Promise<void> {
    await this.prisma.sportsSession.delete({ where: { id } });
  }
}
