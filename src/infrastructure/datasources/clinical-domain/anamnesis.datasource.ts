import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../orm/prisma/prisma.service';
import { AnamnesisDatasource } from '../../../domain/datasources/clinical-domain/anamnesis.datasource';
import { AnamnesisEntity } from '../../../domain/entities/anamnesis.entity';
import { CreateAnamnesisDto, UpdateAnamnesisDto } from '../../../domain';

@Injectable()
export class AnamnesisDatasourceImpl implements AnamnesisDatasource {
  constructor(private readonly prisma: PrismaService) {}

  async createAnamnesis(
    createAnamnesisDto: CreateAnamnesisDto,
  ): Promise<AnamnesisEntity> {
    return this.prisma.anamnesis.create({ data: createAnamnesisDto });
  }

  async getAnamnesisById(id: string): Promise<AnamnesisEntity | null> {
    return this.prisma.anamnesis.findUnique({ where: { id } });
  }

  async updateAnamnesisById(
    id: string,
    updateAnamnesisDto: UpdateAnamnesisDto,
  ): Promise<AnamnesisEntity> {
    return this.prisma.anamnesis.update({
      where: { id },
      data: updateAnamnesisDto,
    });
  }

  async deleteAnamnesisById(id: string): Promise<void> {
    await this.prisma.anamnesis.delete({ where: { id } });
  }
}
