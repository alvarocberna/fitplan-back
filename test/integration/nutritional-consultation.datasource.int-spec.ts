import { NutritionalConsultationDatasourceImpl } from '../../src/infrastructure/persistence/datasources/clinical-domain/nutritional-consultation.datasource';
import { PrismaService } from '../../src/infrastructure/persistence/orm/prisma/prisma.service';
import { PaymentStatus } from '../../src/domain/entities/enums';
import {
  createOrder,
  createPatient,
  createPlanFor,
  createProduct,
} from './support/fixtures';
import { createTestPrisma, resetDatabase } from './support/test-database';

describe('NutritionalConsultationDatasourceImpl (Postgres)', () => {
  let prisma: PrismaService;
  let datasource: NutritionalConsultationDatasourceImpl;
  let patient: Awaited<ReturnType<typeof createPatient>>;
  let productId: string;

  beforeAll(async () => {
    prisma = createTestPrisma();
    await prisma.$connect();
    datasource = new NutritionalConsultationDatasourceImpl(prisma);
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
    patient = await createPatient(prisma);
    productId = (await createProduct(prisma)).id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  const orderFor = (userId: string, data = {}) =>
    createOrder(prisma, { userId, productId }, data);

  const consultationWithDetails = (
    owner: typeof patient,
    orderId: string | null,
    consultationNumber = 1,
  ) =>
    datasource.createNutritionalConsultationWithDetails({
      consultation: {
        clinicalRecordId: owner.clinicalRecord.id,
        patientId: owner.user.id,
        consultationNumber,
        consultationDate: new Date('2026-03-15T12:00:00Z'),
        orderId,
      },
      anamnesis: {
        goals: { mainGoal: 'bajar de peso', secondaryGoal: ['dormir mejor'] },
      },
      measurements: {
        measuredAt: new Date('2026-03-15T12:00:00Z'),
        measurementNumber: consultationNumber,
        basicMeasurements: { weight: 70, height: 175 },
        measurementResults: { bmi: 22.86 },
      },
    } as any);

  it('createNutritionalConsultationWithDetails persiste el árbol completo y lo relee por orden', async () => {
    const order = await orderFor(patient.user.id);

    await consultationWithDetails(patient, order.id);

    const stored: any =
      await datasource.getNutritionalConsultationWithDetailsByOrderId(order.id);
    expect(stored.anamneses[0].goals[0]).toMatchObject({
      mainGoal: 'bajar de peso',
      secondaryGoal: ['dormir mejor'],
    });
    expect(stored.measurements[0]).toMatchObject({
      clinicalRecordId: patient.clinicalRecord.id,
      basicMeasurements: [expect.objectContaining({ weight: 70, height: 175 })],
    });
  });

  it('la base impide dos consultas para la misma orden', async () => {
    const order = await orderFor(patient.user.id);
    await consultationWithDetails(patient, order.id);

    await expect(
      consultationWithDetails(patient, order.id, 2),
    ).rejects.toMatchObject({
      code: 'P2002',
    });
  });

  it('getMaxConsultationNumberByClinicalRecordId no reutiliza números tras un borrado (max + 1)', async () => {
    expect(
      await datasource.getMaxConsultationNumberByClinicalRecordId(
        patient.clinicalRecord.id,
      ),
    ).toBe(0);

    const first = await orderFor(patient.user.id);
    await consultationWithDetails(patient, first.id, 1);
    await consultationWithDetails(patient, null, 2);
    await datasource.deleteNutritionalConsultationByOrderId(first.id);

    expect(
      await datasource.getMaxConsultationNumberByClinicalRecordId(
        patient.clinicalRecord.id,
      ),
    ).toBe(2);
  });

  describe('deleteNutritionalConsultationByOrderId', () => {
    it('borra la consulta y su anamnesis, y conserva las mediciones desvinculadas', async () => {
      const order = await orderFor(patient.user.id);
      const { id } = await consultationWithDetails(patient, order.id);

      expect(
        await datasource.deleteNutritionalConsultationByOrderId(order.id),
      ).toBe(true);

      expect(
        await prisma.nutritionalConsultation.count({ where: { id } }),
      ).toBe(0);
      expect(
        await prisma.anamnesis.count({ where: { consultationId: id } }),
      ).toBe(0);
      expect(await prisma.goals.count()).toBe(0);
      const measurements = await prisma.measurements.findMany({
        where: { clinicalRecordId: patient.clinicalRecord.id },
      });
      expect(measurements).toEqual([
        expect.objectContaining({ consultationId: null }),
      ]);
    });

    it('no borra una consulta que ya tiene plan', async () => {
      const order = await orderFor(patient.user.id);
      const { id } = await consultationWithDetails(patient, order.id);
      await createPlanFor(prisma, id, order.id);

      expect(
        await datasource.deleteNutritionalConsultationByOrderId(order.id),
      ).toBe(false);

      expect(
        await prisma.nutritionalConsultation.count({ where: { id } }),
      ).toBe(1);
      const measurement = await prisma.measurements.findFirstOrThrow({
        where: { clinicalRecordId: patient.clinicalRecord.id },
      });
      expect(measurement.consultationId).toBe(id);
    });

    it('devuelve false si la orden no tiene consulta', async () => {
      const order = await orderFor(patient.user.id);

      expect(
        await datasource.deleteNutritionalConsultationByOrderId(order.id),
      ).toBe(false);
    });

    it('la base impide borrar directamente una consulta con mediciones vinculadas', async () => {
      const { id } = await consultationWithDetails(patient, null);

      await expect(
        datasource.deleteNutritionalConsultationById(id),
      ).rejects.toBeDefined();
    });
  });

  describe('lecturas por dueño y órdenes expiradas', () => {
    it('el detalle de una consulta ajena devuelve null (R2)', async () => {
      const { id } = await consultationWithDetails(patient, null);
      const other = await createPatient(prisma);

      expect(
        await datasource.getNutritionalConsultationDetailByIdAndPatientId(
          id,
          other.user.id,
        ),
      ).toBeNull();
      expect(
        await datasource.getNutritionalConsultationDetailByIdAndPatientId(
          id,
          patient.user.id,
        ),
      ).toMatchObject({ id });
    });

    it('el listado es del paciente, oculta las de orden expirada y conserva las sin orden', async () => {
      const pending = await orderFor(patient.user.id);
      const expired = await orderFor(patient.user.id, {
        paymentStatus: PaymentStatus.EXPIRED,
      });
      const withoutOrder = await consultationWithDetails(patient, null, 1);
      const withPending = await consultationWithDetails(patient, pending.id, 2);
      const withExpired = await consultationWithDetails(patient, expired.id, 3);
      await consultationWithDetails(await createPatient(prisma), null, 1);

      const list =
        await datasource.getNutritionalConsultationsWithStatusByPatientId(
          patient.user.id,
        );

      expect(list.map(({ id }) => id)).toEqual([
        withPending.id,
        withoutOrder.id,
      ]);
      expect(
        await datasource.getNutritionalConsultationDetailByIdAndPatientId(
          withExpired.id,
          patient.user.id,
        ),
      ).toBeNull();
    });

    it('getOrderIdsOfConsultationsWithExpiredOrder ignora las que tienen plan y las no expiradas', async () => {
      const expired = await orderFor(patient.user.id, {
        paymentStatus: PaymentStatus.EXPIRED,
      });
      await consultationWithDetails(patient, expired.id, 1);
      const expiredWithPlan = await orderFor(patient.user.id, {
        paymentStatus: PaymentStatus.EXPIRED,
      });
      const consultationWithPlan = await consultationWithDetails(
        patient,
        expiredWithPlan.id,
        2,
      );
      await createPlanFor(prisma, consultationWithPlan.id, expiredWithPlan.id);
      await consultationWithDetails(
        patient,
        (await orderFor(patient.user.id)).id,
        3,
      );

      expect(
        await datasource.getOrderIdsOfConsultationsWithExpiredOrder(10),
      ).toEqual([expired.id]);
    });
  });

  describe('getLatestNutritionalConsultationWithDetailsByPatientId', () => {
    const addMainPlan = async (consultationId: string, orderId: string) => {
      const plan = await createPlanFor(prisma, consultationId, orderId);
      await prisma.nutritionalPlan.create({
        data: {
          planId: plan.id,
          planName: 'Plan',
          startDate: new Date('2026-03-15'),
          goal: 'definicion',
          dietRegimen: 'omnivora',
          calorieRequirement: 2000,
          proteinRequirement: 120,
          carbohydrateRequirement: 220,
          lipidRequirement: 60,
          calorieIntake: 2000,
          proteinIntake: 120,
          carbohydrateIntake: 220,
          lipidIntake: 60,
        },
      });
    };

    it('devuelve la última consulta con plan, no una más nueva todavía sin plan', async () => {
      const paid = await orderFor(patient.user.id, {
        paymentStatus: PaymentStatus.PAID,
      });
      const withPlan = await consultationWithDetails(patient, paid.id, 1);
      await addMainPlan(withPlan.id, paid.id);
      await consultationWithDetails(
        patient,
        (await orderFor(patient.user.id)).id,
        2,
      );

      const latest =
        await datasource.getLatestNutritionalConsultationWithDetailsByPatientId(
          patient.user.id,
        );

      expect(latest?.id).toBe(withPlan.id);
    });

    it('devuelve null si el paciente no tiene consultas con plan', async () => {
      await consultationWithDetails(patient, null);

      expect(
        await datasource.getLatestNutritionalConsultationWithDetailsByPatientId(
          patient.user.id,
        ),
      ).toBeNull();
    });
  });
});
