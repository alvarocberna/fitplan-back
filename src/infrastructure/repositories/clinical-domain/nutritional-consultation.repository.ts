import { Injectable } from '@nestjs/common';
import { NutritionalConsultationRepository } from '../../../domain/repositories/clinical-domain/nutritional-consultation.repository';
import { NutritionalConsultationDatasource } from '../../../domain/datasources/clinical-domain/nutritional-consultation.datasource';
import { NutritionalConsultationEntity } from '../../../domain/entities/clinical-record.entity';
import {
  CreateNutritionalConsultationDto,
  UpdateNutritionalConsultationDto,
} from '../../../domain';

@Injectable()
export class NutritionalConsultationRepositoryImpl
  implements NutritionalConsultationRepository
{
  constructor(private readonly datasource: NutritionalConsultationDatasource) {}

  createNutritionalConsultation(
    createNutritionalConsultationDto: CreateNutritionalConsultationDto,
  ): Promise<NutritionalConsultationEntity> {
    return this.datasource.createNutritionalConsultation(
      createNutritionalConsultationDto,
    );
  }

  getNutritionalConsultationById(
    id: string,
  ): Promise<NutritionalConsultationEntity | null> {
    return this.datasource.getNutritionalConsultationById(id);
  }

  updateNutritionalConsultationById(
    id: string,
    updateNutritionalConsultationDto: UpdateNutritionalConsultationDto,
  ): Promise<NutritionalConsultationEntity> {
    return this.datasource.updateNutritionalConsultationById(
      id,
      updateNutritionalConsultationDto,
    );
  }

  deleteNutritionalConsultationById(id: string): Promise<void> {
    return this.datasource.deleteNutritionalConsultationById(id);
  }
}
