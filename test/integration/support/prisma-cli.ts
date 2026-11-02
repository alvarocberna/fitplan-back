import { spawnSync, SpawnSyncReturns } from 'node:child_process';
import { join } from 'node:path';

const PROJECT_ROOT = join(__dirname, '..', '..', '..');
const PRISMA_CLI = join(PROJECT_ROOT, 'node_modules', 'prisma', 'build', 'index.js');

// Corre el CLI de Prisma con el node actual (sin npx: en Windows requeriría un shell).
export function runPrismaCli(args: string[], databaseUrl: string): SpawnSyncReturns<string> {
  return spawnSync(process.execPath, [PRISMA_CLI, ...args], {
    cwd: PROJECT_ROOT,
    env: { ...process.env, DATABASE_URL: databaseUrl },
    encoding: 'utf8',
  });
}
