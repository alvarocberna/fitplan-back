import { Injectable } from '@nestjs/common';
import { SportsSession as PrismaSportsSession } from '../../../../generated/prisma';
import { PrismaService } from '../../orm/prisma/prisma.service';
import { SportsSessionDatasource } from '../../../domain/datasources/clinical-domain/sports-session.datasource';
import {
  SportsSessionEntity,
  SportsEventType,
} from '../../../domain/entities/anamnesis.entity';
import {
  CreateSportsSessionDto,
  UpdateSportsSessionDto,
} from '../../../domain';

@Injectable()
export class SportsSessionDatasourceImpl implements SportsSessionDatasource {
  constructor(private readonly prisma: PrismaService) {}

  // `eventType` se guarda como String en Postgres (sin enum nativo en el schema); se castea acá
  // porque las escrituras siempre pasan por CreateSportsSessionDto, que ya lo tipa como SportsEventType.
  private toEntity(sportsSession: PrismaSportsSession): SportsSessionEntity {
    return {
      ...sportsSession,
      eventType: sportsSession.eventType as SportsEventType | null,
    };
  }

  async createSportsSession(
    createSportsSessionDto: CreateSportsSessionDto,
  ): Promise<SportsSessionEntity> {
    const sportsSession = await this.prisma.sportsSession.create({
      data: createSportsSessionDto,
    });
    return this.toEntity(sportsSession);
  }

  async getSportsSessionById(id: string): Promise<SportsSessionEntity | null> {
    const sportsSession = await this.prisma.sportsSession.findUnique({
      where: { id },
    });
    return sportsSession ? this.toEntity(sportsSession) : null;
  }

  async updateSportsSessionById(
    id: string,
    updateSportsSessionDto: UpdateSportsSessionDto,
  ): Promise<SportsSessionEntity> {
    const sportsSession = await this.prisma.sportsSession.update({
      where: { id },
      data: updateSportsSessionDto,
    });
    return this.toEntity(sportsSession);
  }

  async deleteSportsSessionById(id: string): Promise<void> {
    await this.prisma.sportsSession.delete({ where: { id } });
  }
}
