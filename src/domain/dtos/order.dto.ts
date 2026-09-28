import { CompleteConsultationDto } from './consultation.dto';
import { NutritionPlanDto } from './nutrition-plan.dto';

import type { GenerationStatus, PaymentStatus } from '../entities/enums';

// Enums nativos del schema Postgres (ver domain/entities/enums.ts).
export { GenerationStatus, PaymentStatus } from '../entities/enums';

export interface OrderDto {
  id: string;
  email: string;
  payloadJson: CompleteConsultationDto | null;
  paymentStatus: PaymentStatus;
  generationStatus: GenerationStatus;
  planJson: NutritionPlanDto | null;
  attempts: number;
  createdAt: Date;
  updatedAt: Date;
}

// Forma que se expone en GET /orders/:id/status (sin payloadJson, que es información interna
// del pipeline de generación, no algo que el frontend necesite leer).
export interface OrderStatusDto {
  paymentStatus: PaymentStatus;
  generationStatus: GenerationStatus;
  planJson: NutritionPlanDto | null;
  // URL firmada (corta duración) para DESCARGAR el PDF ya subido a S3 (viene con
  // Content-Disposition: attachment y nombre de archivo, por lo que no sirve para un <iframe>);
  // null hasta que el plan termine de generarse. Nunca se persiste, se genera on-demand en cada
  // solicitud (ver FileStorage).
  pdfUrl: string | null;
  // URL firmada (corta duración) de la miniatura WebP de la página 1 del plan; null si aún no hay
  // plan, o si la orden no tiene miniatura (falló su generación, que es best-effort).
  thumbnailUrl: string | null;
}
