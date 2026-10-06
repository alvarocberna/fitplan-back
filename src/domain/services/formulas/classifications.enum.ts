// Antes estos tipos venían del cliente Prisma generado a partir de un schema Postgres
// que no estaba conectado a ningún módulo real de la app. Ahora que Prisma solo modela
// la entidad Order (sobre SQLite, que no soporta enums nativos), estas clasificaciones
// pasan a ser enums de dominio puros, sin depender del ORM.

export enum BmiClassification {
  UNDERWEIGHT = 'UNDERWEIGHT',
  NORMAL_WEIGHT = 'NORMAL_WEIGHT',
  OVERWEIGHT = 'OVERWEIGHT',
  OBESITY_I = 'OBESITY_I',
  OBESITY_II = 'OBESITY_II',
  OBESITY_III = 'OBESITY_III',
}

export enum EvaClassification {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  VERY_HIGH = 'VERY_HIGH',
}
