import { ConsultaCompletaDto } from './consulta-completa.dto';
import { PlanNutricionalDto } from './plan-nutricional.dto';

// SQLite no soporta enums nativos en Prisma (ver prisma/schema.prisma), por eso
// estos estados se tipan acá y se validan/asignan como string a nivel de aplicación.
export type EstadoPago = 'pendiente' | 'pagado';
export type EstadoGeneracion = 'no_iniciado' | 'generando' | 'completado' | 'error';

export interface OrdenDto {
  id: string;
  correo: string;
  payload_json: ConsultaCompletaDto | null;
  estado_pago: EstadoPago;
  estado_generacion: EstadoGeneracion;
  plan_json: PlanNutricionalDto | null;
  intentos: number;
  created_at: Date;
  updated_at: Date;
}

// Forma que se expone en GET /ordenes/:id (sin payload_json, que es información interna
// del pipeline de generación, no algo que el frontend necesite leer).
export interface OrdenEstadoDto {
  estado_pago: EstadoPago;
  estado_generacion: EstadoGeneracion;
  plan_json: PlanNutricionalDto | null;
}
