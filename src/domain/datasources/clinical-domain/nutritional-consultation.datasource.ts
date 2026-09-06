import { NutritionalConsultationEntity } from '../../entities/clinical-record.entity';
import {
  CreateNutritionalConsultationDto,
  UpdateNutritionalConsultationDto,
  CreateNutritionalConsultationDetailsDto,
} from '../..';

export abstract class NutritionalConsultationDatasource {
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

  // Crea la consulta junto con todo su árbol (Anamnesis+hijas, Measurements+hija) en una sola
  // operación atómica (nested create de Prisma). Reemplaza al antiguo payloadJson.
  abstract createNutritionalConsultationWithDetails(
    dto: CreateNutritionalConsultationDetailsDto,
  ): Promise<NutritionalConsultationEntity>;

  // Lectura enriquecida (mismo árbol de arriba, vía include) a partir del orderId — es lo que usa
  // plan-generation para reconstruir el CompleteConsultationDto sin tocar Prisma directamente.
  abstract getNutritionalConsultationWithDetailsByOrderId(
    orderId: string,
  ): Promise<NutritionalConsultationEntity | null>;

  abstract countNutritionalConsultationsByClinicalRecordId(
    clinicalRecordId: string,
  ): Promise<number>;
}
