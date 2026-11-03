import { MeasurementsDatasourceImpl } from '../../src/infrastructure/persistence/datasources/clinical-domain/measurements.datasource';
import { PrismaService } from '../../src/infrastructure/persistence/orm/prisma/prisma.service';
import { createPatient } from './support/fixtures';
import { createTestPrisma, resetDatabase } from './support/test-database';

describe('MeasurementsDatasourceImpl (Postgres)', () => {
  let prisma: PrismaService;
  let datasource: MeasurementsDatasourceImpl;
  let patient: Awaited<ReturnType<typeof createPatient>>;

  beforeAll(async () => {
    prisma = createTestPrisma();
    await prisma.$connect();
    datasource = new MeasurementsDatasourceImpl(prisma);
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
    patient = await createPatient(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  const measurementOf = (
    owner: typeof patient,
    measuredAt: string,
    measurementNumber = 1,
    extras: { results?: { bmi: number } } = {},
  ) =>
    datasource.createMeasurementWithDetails({
      clinicalRecordId: owner.clinicalRecord.id,
      measuredAt: new Date(measuredAt),
      measurementNumber,
      basic: { weight: 70, height: 175 },
      ...extras,
    } as any);

  const basicOf = (measurementsId: string) =>
    prisma.basicMeasurements.findFirstOrThrow({ where: { measurementsId } });

  it('createMeasurementWithDetails crea una medición suelta con sus valores y resultados', async () => {
    const { id } = await measurementOf(patient, '2026-05-10T12:00:00Z', 1, {
      results: { bmi: 22.86 },
    });

    const detail: any = await datasource.getMeasurementDetailByIdAndPatientId(
      id,
      patient.user.id,
    );

    expect(detail).toMatchObject({
      consultationId: null,
      basicMeasurements: [expect.objectContaining({ weight: 70, height: 175 })],
      measurementResults: [expect.objectContaining({ bmi: 22.86 })],
    });
  });

  it('el detalle de una medición ajena devuelve null (R2)', async () => {
    const { id } = await measurementOf(patient, '2026-05-10T12:00:00Z');
    const other = await createPatient(prisma);

    expect(
      await datasource.getMeasurementDetailByIdAndPatientId(id, other.user.id),
    ).toBeNull();
  });

  it('el listado es solo del paciente, de la más nueva a la más antigua', async () => {
    const older = await measurementOf(patient, '2026-05-01T12:00:00Z', 1);
    const newer = await measurementOf(patient, '2026-05-20T12:00:00Z', 2);
    await measurementOf(await createPatient(prisma), '2026-05-15T12:00:00Z');

    const list = await datasource.listMeasurementsByPatientId(patient.user.id);

    expect(list.map(({ id }) => id)).toEqual([newer.id, older.id]);
  });

  it('el rango de fechas incluye ambos límites y admite un solo extremo', async () => {
    const may1 = await measurementOf(patient, '2026-05-01T12:00:00Z', 1);
    const may10 = await measurementOf(patient, '2026-05-10T12:00:00Z', 2);
    const may20 = await measurementOf(patient, '2026-05-20T12:00:00Z', 3);
    const ids = async (range: { from?: Date; to?: Date }) =>
      (
        await datasource.listMeasurementsByPatientId(patient.user.id, range)
      ).map(({ id }) => id);

    expect(
      await ids({
        from: new Date('2026-05-01T12:00:00Z'),
        to: new Date('2026-05-10T12:00:00Z'),
      }),
    ).toEqual([may10.id, may1.id]);
    expect(await ids({ from: new Date('2026-05-10T00:00:00Z') })).toEqual([
      may20.id,
      may10.id,
    ]);
    expect(await ids({ to: new Date('2026-05-02T00:00:00Z') })).toEqual([
      may1.id,
    ]);
  });

  it('getLatestMeasurementsWithResultsByPatientId usa la fecha de medición, no la de creación', async () => {
    const latestByDate = await measurementOf(
      patient,
      '2026-05-20T12:00:00Z',
      1,
    );
    await measurementOf(patient, '2026-05-01T12:00:00Z', 2);

    const latest = await datasource.getLatestMeasurementsWithResultsByPatientId(
      patient.user.id,
    );

    expect(latest?.id).toBe(latestByDate.id);
  });

  it('getMaxMeasurementNumberByClinicalRecordId no mezcla historiales', async () => {
    await measurementOf(patient, '2026-05-01T12:00:00Z', 7);
    const other = await createPatient(prisma);

    expect(
      await datasource.getMaxMeasurementNumberByClinicalRecordId(
        patient.clinicalRecord.id,
      ),
    ).toBe(7);
    expect(
      await datasource.getMaxMeasurementNumberByClinicalRecordId(
        other.clinicalRecord.id,
      ),
    ).toBe(0);
  });

  describe('updateMeasurementWithDetails', () => {
    it('corrige solo los campos enviados y no duplica filas hijas', async () => {
      const { id } = await measurementOf(patient, '2026-05-10T12:00:00Z', 1, {
        results: { bmi: 22.86 },
      });

      await datasource.updateMeasurementWithDetails(id, {
        basic: { weight: 69 },
        results: { bmi: 22.53 },
      });

      expect(await basicOf(id)).toMatchObject({ weight: 69, height: 175 });
      expect(
        await prisma.basicMeasurements.count({ where: { measurementsId: id } }),
      ).toBe(1);
      expect(
        await prisma.measurementResults.findMany({
          where: { measurementsId: id },
        }),
      ).toEqual([expect.objectContaining({ bmi: 22.53 })]);
    });

    it('crea los resultados si la medición aún no tenía', async () => {
      const { id } = await measurementOf(patient, '2026-05-10T12:00:00Z');

      await datasource.updateMeasurementWithDetails(id, {
        results: { bmi: 22.86 },
      });

      expect(
        await prisma.measurementResults.count({
          where: { measurementsId: id },
        }),
      ).toBe(1);
    });

    it('si falla una parte, deshace toda la edición', async () => {
      const original = '2026-05-10T12:00:00.000Z';
      const { id } = await measurementOf(patient, original);

      await expect(
        datasource.updateMeasurementWithDetails(id, {
          measuredAt: new Date('2026-06-01T12:00:00Z'),
          basic: { weight: 69 },
          results: { columnaInexistente: 1 },
        } as any),
      ).rejects.toBeDefined();

      const stored = await prisma.measurements.findUniqueOrThrow({
        where: { id },
      });
      expect(stored.measuredAt.toISOString()).toBe(original);
      expect((await basicOf(id)).weight).toBe(70);
    });
  });
});
