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

  // Borra la consulta creada para una orden que expiró sin pagarse, en una transacción: desvincula
  // sus mediciones (quedan en la ficha clínica como mediciones sueltas, consultation_id = null) y
  // elimina la consulta, cuya anamnesis cae en cascada. Devuelve false, sin borrar nada, si la orden
  // no tiene consulta o si la consulta ya tiene un plan.
  abstract deleteNutritionalConsultationByOrderId(
    orderId: string,
  ): Promise<boolean>;

  // order_id de las consultas que siguen existiendo aunque su orden ya expiró (el borrado disparado
  // por order.expired falló o el evento se perdió), las más antiguas primero. Excluye las que tienen
  // un plan, que deleteNutritionalConsultationByOrderId tampoco borra.
  abstract getOrderIdsOfConsultationsWithExpiredOrder(
    limit: number,
  ): Promise<string[]>;

  // Mayor consultation_number de la ficha clínica (0 si no tiene consultas). Se usa max y no count
  // porque las consultas de órdenes expiradas se borran: count + 1 repetiría números.
  abstract getMaxConsultationNumberByClinicalRecordId(
    clinicalRecordId: string,
  ): Promise<number>;

  // Todas las consultas del paciente (salvo las de órdenes expiradas), más reciente primero, con anamneses.goals, la orden (solo id y
  // estados) y el plan activo -> nutritionalPlan principal — usada por el listado de consultas
  // (GET /me/consultations, modules/clinical). Sin consultas -> [].
  abstract getNutritionalConsultationsWithStatusByPatientId(
    patientId: string,
  ): Promise<NutritionalConsultationEntity[]>;

  // Detalle de una consulta SOLO si pertenece al paciente (R2: null si no existe, no es suya o su
  // orden expiró), con
  // anamneses.goals, la orden (solo id y estados), las mediciones de la consulta (basicMeasurements +
  // measurementResults) y el plan activo -> nutritionalPlan principal — usada por
  // GET /me/consultations/:id (modules/clinical).
  abstract getNutritionalConsultationDetailByIdAndPatientId(
    id: string,
    patientId: string,
  ): Promise<NutritionalConsultationEntity | null>;
}
