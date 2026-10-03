import { Prisma } from '../../../../../generated/prisma';

// P2002: violación de una restricción de unicidad.
export function isUniqueConstraintError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  );
}
