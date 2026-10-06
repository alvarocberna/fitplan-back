import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../orm/prisma/prisma.service';
import { SkinfoldsDatasource } from '../../../../domain/datasources/clinical-domain/skinfolds.datasource';
import { SkinfoldsEntity } from '../../../../domain/entities/measurements.entity';
import { CreateSkinfoldsDto, UpdateSkinfoldsDto } from '../../../../domain';

@Injectable()
export class SkinfoldsDatasourceImpl implements SkinfoldsDatasource {
  constructor(private readonly prisma: PrismaService) {}

  async createSkinfolds(
    createSkinfoldsDto: CreateSkinfoldsDto,
  ): Promise<SkinfoldsEntity> {
    return this.prisma.skinfolds.create({ data: createSkinfoldsDto });
  }

  async getSkinfoldsById(id: string): Promise<SkinfoldsEntity | null> {
    return this.prisma.skinfolds.findUnique({ where: { id } });
  }

  async updateSkinfoldsById(
    id: string,
    updateSkinfoldsDto: UpdateSkinfoldsDto,
  ): Promise<SkinfoldsEntity> {
    return this.prisma.skinfolds.update({
      where: { id },
      data: updateSkinfoldsDto,
    });
  }

  async deleteSkinfoldsById(id: string): Promise<void> {
    await this.prisma.skinfolds.delete({ where: { id } });
  }
}
