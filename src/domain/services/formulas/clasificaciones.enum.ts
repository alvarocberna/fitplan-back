// Antes estos tipos venían del cliente Prisma generado a partir de un schema Postgres
// que no estaba conectado a ningún módulo real de la app. Ahora que Prisma solo modela
// la entidad Orden (sobre SQLite, que no soporta enums nativos), estas clasificaciones
// pasan a ser enums de dominio puros, sin depender del ORM.

export enum IMCClasificacion {
  BAJO_PESO = 'BAJO_PESO',
  NORMO_PESO = 'NORMO_PESO',
  SOBRE_PESO = 'SOBRE_PESO',
  OBESIDAD_I = 'OBESIDAD_I',
  OBESIDAD_II = 'OBESIDAD_II',
  OBESIDAD_III = 'OBESIDAD_III',
}

export enum EvaClasificacion {
  BAJO = 'BAJO',
  MEDIO = 'MEDIO',
  ALTO = 'ALTO',
  MUY_ALTO = 'MUY_ALTO',
}
