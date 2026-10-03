import { Injectable } from '@nestjs/common';
import { NutritionalConsultationRepository } from '../../../../domain/repositories/clinical-domain/nutritional-consultation.repository';
import { NutritionalConsultationDatasource } from '../../../../domain/datasources/clinical-domain/nutritional-consultation.datasource';
import { NutritionalConsultationEntity } from '../../../../domain/entities/clinical-record.entity';
import {
  CreateNutritionalConsultationDto,
  UpdateNutritionalConsultationDto,
  CreateNutritionalConsultationDetailsDto,
} from '../../../../domain';

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

  createNutritionalConsultationWithDetails(
    dto: CreateNutritionalConsultationDetailsDto,
  ): Promise<NutritionalConsultationEntity> {
    return this.datasource.createNutritionalConsultationWithDetails(dto);
  }

  getNutritionalConsultationWithDetailsByOrderId(
    orderId: string,
  ): Promise<NutritionalConsultationEntity | null> {
    return this.datasource.getNutritionalConsultationWithDetailsByOrderId(
      orderId,
    );
  }

  getLatestNutritionalConsultationWithDetailsByPatientId(
    patientId: string,
  ): Promise<NutritionalConsultationEntity | null> {
    return this.datasource.getLatestNutritionalConsultationWithDetailsByPatientId(
      patientId,
    );
  }

  deleteNutritionalConsultationByOrderId(orderId: string): Promise<boolean> {
    return this.datasource.deleteNutritionalConsultationByOrderId(orderId);
  }

  getMaxConsultationNumberByClinicalRecordId(
    clinicalRecordId: string,
  ): Promise<number> {
    return this.datasource.getMaxConsultationNumberByClinicalRecordId(
      clinicalRecordId,
    );
  }

  getNutritionalConsultationsWithStatusByPatientId(
    patientId: string,
  ): Promise<NutritionalConsultationEntity[]> {
    return this.datasource.getNutritionalConsultationsWithStatusByPatientId(
      patientId,
    );
  }

  getNutritionalConsultationDetailByIdAndPatientId(
    id: string,
    patientId: string,
  ): Promise<NutritionalConsultationEntity | null> {
    return this.datasource.getNutritionalConsultationDetailByIdAndPatientId(
      id,
      patientId,
    );
  }
}
