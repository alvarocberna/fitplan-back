import { NutritionalConsultationEntity } from '../../entities/clinical-record.entity';
import {
  CreateNutritionalConsultationDto,
  UpdateNutritionalConsultationDto,
  CreateNutritionalConsultationDetailsDto,
} from '../..';

export abstract class NutritionalConsultationRepository {
  abstract createNutritionalConsultation(
    createNutritionalConsultationDto: CreateNutritionalConsultationDto,
  ): Promise<NutritionalConsultationEntity>;
  abstract getNutritionalConsultationById(
    id: string,
  ): Promise<NutritionalConsultationEntity | null>;
  abstract updateNutritionalConsultationById(
    id: string,
    updateNutritionalConsultationDto: UpdateNutritionalConsultationDto,
  ): Promise<NutritionalConsultationEntity>;
  abstract deleteNutritionalConsultationById(id: string): Promise<void>;
  abstract createNutritionalConsultationWithDetails(
    dto: CreateNutritionalConsultationDetailsDto,
  ): Promise<NutritionalConsultationEntity>;
  abstract getNutritionalConsultationWithDetailsByOrderId(
    orderId: string,
  ): Promise<NutritionalConsultationEntity | null>;
  abstract getLatestNutritionalConsultationWithDetailsByPatientId(
    patientId: string,
  ): Promise<NutritionalConsultationEntity | null>;
  abstract deleteNutritionalConsultationByOrderId(
    orderId: string,
  ): Promise<boolean>;
  abstract getOrderIdsOfConsultationsWithExpiredOrder(
    limit: number,
  ): Promise<string[]>;
  abstract getMaxConsultationNumberByClinicalRecordId(
    clinicalRecordId: string,
  ): Promise<number>;
  abstract getNutritionalConsultationsWithStatusByPatientId(
    patientId: string,
  ): Promise<NutritionalConsultationEntity[]>;
  abstract getNutritionalConsultationDetailByIdAndPatientId(
    id: string,
    patientId: string,
  ): Promise<NutritionalConsultationEntity | null>;
}
