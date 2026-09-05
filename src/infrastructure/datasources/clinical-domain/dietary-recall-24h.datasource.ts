import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../orm/prisma/prisma.service';
import { DietaryRecall24hDatasource } from '../../../domain/datasources/clinical-domain/dietary-recall-24h.datasource';
import { DietaryRecall24hEntity } from '../../../domain/entities/anamnesis.entity';
import {
  CreateDietaryRecall24hDto,
  UpdateDietaryRecall24hDto,
} from '../../../domain';

@Injectable()
export class DietaryRecall24hDatasourceImpl
  implements DietaryRecall24hDatasource
{
  constructor(private readonly prisma: PrismaService) {}

  async createDietaryRecall24h(
    createDietaryRecall24hDto: CreateDietaryRecall24hDto,
  ): Promise<DietaryRecall24hEntity> {
    return this.prisma.dietaryRecall24h.create({
      data: createDietaryRecall24hDto,
    });
  }

  async getDietaryRecall24hById(
    id: string,
  ): Promise<DietaryRecall24hEntity | null> {
    return this.prisma.dietaryRecall24h.findUnique({ where: { id } });
  }

  async updateDietaryRecall24hById(
    id: string,
    updateDietaryRecall24hDto: UpdateDietaryRecall24hDto,
  ): Promise<DietaryRecall24hEntity> {
    return this.prisma.dietaryRecall24h.update({
      where: { id },
      data: updateDietaryRecall24hDto,
    });
  }

  async deleteDietaryRecall24hById(id: string): Promise<void> {
    await this.prisma.dietaryRecall24h.delete({ where: { id } });
  }
}
