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

// Forma que se expone en GET /ordenes/:id (sin payloadJson, que es información interna
// del pipeline de generación, no algo que el frontend necesite leer).
export interface OrderStatusDto {
  paymentStatus: PaymentStatus;
  generationStatus: GenerationStatus;
  planJson: NutritionPlanDto | null;
  // URL firmada (corta duración) para DESCARGAR el PDF ya subido a S3 (viene con
  // Content-Disposition: attachment y nombre de archivo, por lo que no sirve para un <iframe>);
  // null hasta que el plan termine de generarse. Nunca se persiste, se genera on-demand en cada
  // solicitud (ver StorageService).
  pdfUrl: string | null;
  // URL firmada (corta duración) de la miniatura WebP de la página 1 del plan; null si aún no hay
  // plan, o si la orden no tiene miniatura (falló su generación, que es best-effort).
  thumbnailUrl: string | null;
}

// Forma que se expone en GET /ordenes: un ítem por cada orden con plan generado y PDF
// disponible, del usuario autenticado.
export interface OrderSummaryDto {
  orderId: string;
  creationDate: Date;
  // URL firmada (corta duración) para DESCARGAR el PDF: viene con Content-Disposition: attachment y
  // nombre de archivo, por lo que no sirve para incrustarlo en un <iframe> (para eso, GET
  // /ordenes/obtener-estado/:id).
  pdfUrl: string;
  // URL firmada (corta duración) de la miniatura WebP de la página 1 del plan; null si la orden no
  // tiene miniatura (plan anterior a esta función, o falló su generación).
  thumbnailUrl: string | null;
}
