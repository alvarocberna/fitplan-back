import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { runPrismaCli } from './prisma-cli';

// Misma versión mayor que fitplan-db/Dockerfile.
const POSTGRES_IMAGE = 'postgres:16-alpine';

declare global {
  // Lo comparte con global-teardown: Jest corre ambos en el mismo proceso.
  var __INTEGRATION_POSTGRES__: StartedPostgreSqlContainer | undefined;
}

// Levanta un Postgres desechable y le aplica las migraciones reales. Los workers de Jest heredan estas
// variables, así que PrismaService se conecta a este contenedor y no al DATABASE_URL del .env.
export default async function globalSetup(): Promise<void> {
  const container = await new PostgreSqlContainer(POSTGRES_IMAGE).start();
  globalThis.__INTEGRATION_POSTGRES__ = container;

  const url = container.getConnectionUri();
  process.env.DATABASE_URL = url;
  process.env.INTEGRATION_DATABASE_URL = url;

  const migrate = runPrismaCli(['migrate', 'deploy'], url);
  if (migrate.status !== 0) {
    await container.stop();
    throw new Error(
      `prisma migrate deploy falló:\n${migrate.stdout}\n${migrate.stderr}`,
    );
  }
}
