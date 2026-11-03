import { runPrismaCli } from './support/prisma-cli';
import { assertUsingTestContainer } from './support/test-database';

describe('migraciones de Prisma', () => {
  it('aplicadas desde cero dejan la base igual a schema.prisma', () => {
    assertUsingTestContainer();
    const url = process.env.INTEGRATION_DATABASE_URL!;

    // --exit-code: 0 sin diferencias, 2 con diferencias, 1 si falla el comando.
    const diff = runPrismaCli(
      [
        'migrate',
        'diff',
        '--from-url',
        url,
        '--to-schema-datamodel',
        'prisma/schema.prisma',
        '--script',
        '--exit-code',
      ],
      url,
    );

    expect({
      status: diff.status,
      drift: diff.stdout,
      error: diff.stderr,
    }).toEqual({
      status: 0,
      drift: expect.any(String),
      error: expect.any(String),
    });
  });
});
