import type { MeasurementLevel } from '../../../domain/entities/enums';
import type {
  ConsultationPlanStatus,
  ConsultationPlanSummaryDto,
} from './consultation-summary.dto';

// Medición tomada en la consulta. Versión reducida de MeasurementDetailDto (ese, con rangos de
// referencia por indicador, es de CU-CLI-04): solo los datos básicos y los resultados guardados en
// measurement_results (null si no se calcularon).
export interface ConsultationMeasurementDto {
  measurementId: string;
  measurementNumber: number;
  measuredAt: string; // ISO
  level: MeasurementLevel | null;
  basic: {
    weight: number;
    height: number;
    sittingHeight: number | null;
    armSpan: number | null;
  } | null;
  results: {
    bmi: number | null;
    bmiClassification: string | null;
    bfPercentage: number | null;
    bfClassification: string | null;
  } | null;
}

// Respuesta de GET /me/consultations/:consultationId (CU-CLI-02).
export interface ConsultationDetailDto {
  consultationId: string;
  consultationNumber: number;
  consultationDate: string; // ISO
  goals: { mainGoal: string | null; secondaryGoals: string[] };
  planStatus: ConsultationPlanStatus | null;
  orderId: string | null;
  measurements: ConsultationMeasurementDto[];
  // orderId permite navegar al plan (hoy /ordenes/[id] en el frontend; a futuro CU-PLN-05).
  // pdfUrl: URL firmada de descarga del PDF (R4), null si la orden todavía no tiene PDF.
  plan:
    | (ConsultationPlanSummaryDto & { orderId: string; pdfUrl: string | null })
    | null;
}
