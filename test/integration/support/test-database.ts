import { PrismaService } from '../../../src/infrastructure/persistence/orm/prisma/prisma.service';

// PrismaService toma DATABASE_URL, que global-setup apunta al contenedor. Se verifica igual porque
// resetDatabase trunca todas las tablas: nunca debe correr contra otra base.
export function assertUsingTestContainer(): void {
  const expected = process.env.INTEGRATION_DATABASE_URL;
  if (!expected || process.env.DATABASE_URL !== expected) {
    throw new Error(
      'Los tests de integración deben correr contra el contenedor de global-setup',
    );
  }
}

export function createTestPrisma(): PrismaService {
  assertUsingTestContainer();
  return new PrismaService();
}

export async function resetDatabase(prisma: PrismaService): Promise<void> {
  assertUsingTestContainer();
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'
  `;
  const names = tables.map(({ tablename }) => `"${tablename}"`).join(', ');
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${names} CASCADE`);
}
