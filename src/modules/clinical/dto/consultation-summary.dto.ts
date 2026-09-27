// Estado del plan asociado a la consulta, derivado de los estados de su orden (ver
// ListMyConsultationsUseCase): pendiente de pago, generándose, listo o con error.
export type ConsultationPlanStatus =
  | 'awaiting_payment'
  | 'generating'
  | 'ready'
  | 'error';

// Resumen del NutritionalPlan principal del plan activo de la consulta (solo los campos de ingesta
// real, nunca los de requerimiento).
export interface ConsultationPlanSummaryDto {
  planName: string;
  goal: string;
  dietRegimen: string;
  calorieIntake: number;
  proteinIntake: number;
  carbohydrateIntake: number;
  lipidIntake: number;
}

// Ítem de GET /me/consultations (CU-CLI-01).
export interface ConsultationSummaryDto {
  consultationId: string;
  consultationNumber: number;
  consultationDate: string; // ISO
  mainGoal: string | null;
  // null solo si la consulta no tiene orden asociada (consultas anteriores al flujo de pago).
  planStatus: ConsultationPlanStatus | null;
  orderId: string | null;
  plan: ConsultationPlanSummaryDto | null;
}
