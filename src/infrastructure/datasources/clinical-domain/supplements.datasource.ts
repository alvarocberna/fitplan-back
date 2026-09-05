import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../orm/prisma/prisma.service';
import { SupplementsDatasource } from '../../../domain/datasources/clinical-domain/supplements.datasource';
import { SupplementsEntity } from '../../../domain/entities/anamnesis.entity';
import { CreateSupplementsDto, UpdateSupplementsDto } from '../../../domain';

@Injectable()
export class SupplementsDatasourceImpl implements SupplementsDatasource {
  constructor(private readonly prisma: PrismaService) {}

  async createSupplements(
    createSupplementsDto: CreateSupplementsDto,
  ): Promise<SupplementsEntity> {
    return this.prisma.supplements.create({ data: createSupplementsDto });
  }

  async getSupplementsById(id: string): Promise<SupplementsEntity | null> {
    return this.prisma.supplements.findUnique({ where: { id } });
  }

  async updateSupplementsById(
    id: string,
    updateSupplementsDto: UpdateSupplementsDto,
  ): Promise<SupplementsEntity> {
    return this.prisma.supplements.update({
      where: { id },
      data: updateSupplementsDto,
    });
  }

  async deleteSupplementsById(id: string): Promise<void> {
    await this.prisma.supplements.delete({ where: { id } });
  }
}
