import { NutritionalConsultationEntity } from '../../entities/clinical-record.entity';
import {
  CreateNutritionalConsultationDto,
  UpdateNutritionalConsultationDto,
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
}
