import { CompleteConsultationDto } from './consultation.dto';
import { NutritionPlanDto } from './nutrition-plan.dto';

// SQLite no soporta enums nativos en Prisma (ver prisma/schema.prisma), por eso
// estos estados se tipan acá y se validan/asignan como string a nivel de aplicación.
export type PaymentStatus = 'pendiente' | 'pagado';
export type GenerationStatus = 'no_iniciado' | 'generando' | 'completado' | 'error';

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
  // URL firmada (corta duración) del PDF ya subido a S3; null hasta que el plan termine de
  // generarse. Nunca se persiste, se genera on-demand en cada solicitud (ver StorageService).
  pdfUrl: string | null;
}

// Forma que se expone en GET /ordenes: un ítem por cada orden con plan generado y PDF
// disponible, del usuario autenticado.
export interface OrderSummaryDto {
  orderId: string;
  creationDate: Date;
  pdfUrl: string;
}
