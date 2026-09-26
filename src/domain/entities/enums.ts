// Enums del dominio: espejo de los `enum` de prisma/schema.prisma (enums nativos de Postgres).
// Se definen como objeto `as const` + tipo unión (la misma forma que genera Prisma) para que el
// dominio no dependa del cliente generado y los valores sean intercambiables en ambos sentidos.
// Usar siempre estas constantes (p. ej. PaymentStatus.PAID) en vez de literales sueltos.

export const AuthProvider = {
  COGNITO: 'COGNITO',
  GOOGLE: 'GOOGLE',
} as const;
export type AuthProvider = (typeof AuthProvider)[keyof typeof AuthProvider];

export const SportsEventType = {
  TRAINING: 'TRAINING',
  COMPETITION: 'COMPETITION',
} as const;
export type SportsEventType =
  (typeof SportsEventType)[keyof typeof SportsEventType];

// En la base de datos ISAK_1 se guarda como 'ISAK 1' (@map en el schema); Prisma lo traduce.
export const MeasurementLevel = {
  BASIC: 'BASIC',
  ISAK_1: 'ISAK_1',
  BIOIMPEDANCE: 'BIOIMPEDANCE',
} as const;
export type MeasurementLevel =
  (typeof MeasurementLevel)[keyof typeof MeasurementLevel];

export const PlanPeriod = {
  EVENTO: 'EVENTO',
  MICROCICLO: 'MICROCICLO',
  MESOCICLO: 'MESOCICLO',
  MACROCICLO: 'MACROCICLO',
} as const;
export type PlanPeriod = (typeof PlanPeriod)[keyof typeof PlanPeriod];

export const PlanMealTimeSlot = {
  BREAKFAST: 'BREAKFAST',
  LUNCH: 'LUNCH',
  AFTERNOON_TEA: 'AFTERNOON_TEA',
  DINNER: 'DINNER',
  SNACK: 'SNACK',
} as const;
export type PlanMealTimeSlot =
  (typeof PlanMealTimeSlot)[keyof typeof PlanMealTimeSlot];

export const PlanMealTimeNoteType = {
  EXAMPLE: 'EXAMPLE',
  COMMENT: 'COMMENT',
} as const;
export type PlanMealTimeNoteType =
  (typeof PlanMealTimeNoteType)[keyof typeof PlanMealTimeNoteType];

export const PlanSupplementNoteType = {
  EFFECT: 'EFFECT',
  CONSIDERATION: 'CONSIDERATION',
} as const;
export type PlanSupplementNoteType =
  (typeof PlanSupplementNoteType)[keyof typeof PlanSupplementNoteType];

export const ProductType = {
  PREDEFINED: 'PREDEFINED',
  GENERATED: 'GENERATED',
} as const;
export type ProductType = (typeof ProductType)[keyof typeof ProductType];

export const PaymentStatus = {
  PENDING: 'PENDING',
  PAID: 'PAID',
} as const;
export type PaymentStatus = (typeof PaymentStatus)[keyof typeof PaymentStatus];

// Estado del pipeline de generación del plan.
export const GenerationStatus = {
  NOT_STARTED: 'NOT_STARTED',
  GENERATING: 'GENERATING',
  COMPLETED: 'COMPLETED',
  ERROR: 'ERROR',
} as const;
export type GenerationStatus =
  (typeof GenerationStatus)[keyof typeof GenerationStatus];

// 'SIMULATED' es el pago simulado (POST /webhooks/ordenes/:id/simular-pago) mientras no haya una
// pasarela real integrada.
export const PaymentProvider = {
  TRANSBANK: 'TRANSBANK',
  SIMULATED: 'SIMULATED',
} as const;
export type PaymentProvider =
  (typeof PaymentProvider)[keyof typeof PaymentProvider];

export const PaymentTransactionStatus = {
  AUTHORIZED: 'AUTHORIZED',
  REJECTED: 'REJECTED',
  CANCELLED: 'CANCELLED',
} as const;
export type PaymentTransactionStatus =
  (typeof PaymentTransactionStatus)[keyof typeof PaymentTransactionStatus];
