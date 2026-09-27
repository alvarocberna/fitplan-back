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

  // Lectura enriquecida (patient, anamneses.goals, nutritionalPlans) de la consulta más reciente
  // de un paciente QUE YA TIENE un plan generado (las consultas pendientes de pago/generación se
  // ignoran) — usada por el resumen del panel (GET /me/summary, modules/identity).
  abstract getLatestNutritionalConsultationWithDetailsByPatientId(
    patientId: string,
  ): Promise<NutritionalConsultationEntity | null>;

  abstract countNutritionalConsultationsByClinicalRecordId(
    clinicalRecordId: string,
  ): Promise<number>;

  // Todas las consultas del paciente, más reciente primero, con anamneses.goals, la orden (solo id y
  // estados) y el plan activo -> nutritionalPlan principal — usada por el listado de consultas
  // (GET /me/consultations, modules/clinical). Sin consultas -> [].
  abstract getNutritionalConsultationsWithStatusByPatientId(
    patientId: string,
  ): Promise<NutritionalConsultationEntity[]>;

  // Detalle de una consulta SOLO si pertenece al paciente (R2: null si no existe o no es suya), con
  // anamneses.goals, la orden (solo id y estados), las mediciones de la consulta (basicMeasurements +
  // measurementResults) y el plan activo -> nutritionalPlan principal — usada por
  // GET /me/consultations/:id (modules/clinical).
  abstract getNutritionalConsultationDetailByIdAndPatientId(
    id: string,
    patientId: string,
  ): Promise<NutritionalConsultationEntity | null>;
}
