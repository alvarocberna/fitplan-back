import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../orm/prisma/prisma.service';
import { LifestyleDatasource } from '../../../../domain/datasources/clinical-domain/lifestyle.datasource';
import { LifestyleEntity } from '../../../../domain/entities/anamnesis.entity';
import { CreateLifestyleDto, UpdateLifestyleDto } from '../../../../domain';

@Injectable()
export class LifestyleDatasourceImpl implements LifestyleDatasource {
  constructor(private readonly prisma: PrismaService) {}

  async createLifestyle(
    createLifestyleDto: CreateLifestyleDto,
  ): Promise<LifestyleEntity> {
    return this.prisma.lifestyle.create({ data: createLifestyleDto });
  }

  async getLifestyleById(id: string): Promise<LifestyleEntity | null> {
    return this.prisma.lifestyle.findUnique({ where: { id } });
  }

  async updateLifestyleById(
    id: string,
    updateLifestyleDto: UpdateLifestyleDto,
  ): Promise<LifestyleEntity> {
    return this.prisma.lifestyle.update({
      where: { id },
      data: updateLifestyleDto,
    });
  }

  async deleteLifestyleById(id: string): Promise<void> {
    await this.prisma.lifestyle.delete({ where: { id } });
  }
}
