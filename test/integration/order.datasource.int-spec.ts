import { OrderDatasourceImpl } from '../../src/infrastructure/persistence/datasources/commercial-domain/order.datasource';
import { PrismaService } from '../../src/infrastructure/persistence/orm/prisma/prisma.service';
import {
  GenerationStatus,
  PaymentProvider,
  PaymentStatus,
  PaymentTransactionStatus,
  ProductType,
} from '../../src/domain/entities/enums';
import { createOrder, createProduct, createUser, hoursFromNow } from './support/fixtures';
import { createTestPrisma, resetDatabase } from './support/test-database';

const paymentResult = (status: PaymentTransactionStatus = PaymentTransactionStatus.AUTHORIZED) => ({
  provider: PaymentProvider.TRANSBANK,
  paymentIdentifier: 'buy-order-1',
  amount: 4990,
  status,
});

describe('OrderDatasourceImpl (Postgres)', () => {
  let prisma: PrismaService;
  let datasource: OrderDatasourceImpl;
  let refs: { userId: string; productId: string };

  beforeAll(async () => {
    prisma = createTestPrisma();
    await prisma.$connect();
    datasource = new OrderDatasourceImpl(prisma);
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
    const [user, product] = [await createUser(prisma), await createProduct(prisma)];
    refs = { userId: user.id, productId: product.id };
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  const initiatedPayment = (orderId: string, token = 'token-1') =>
    prisma.payment.create({
      data: {
        orderId,
        token,
        provider: PaymentProvider.TRANSBANK,
        paymentIdentifier: 'buy-order-1',
        amount: 4990,
        status: PaymentTransactionStatus.INITIATED,
      },
    });

  describe('markOrderAsPaidWithPayment', () => {
    it('marca la orden, fija la fecha de pago, aplica los extras y completa el intento', async () => {
      const order = await createOrder(prisma, refs);
      const payment = await initiatedPayment(order.id);

      const marked = await datasource.markOrderAsPaidWithPayment(
        order.id,
        { ...paymentResult(), authorizationCode: '1213' },
        { pdfKey: 'productos/plan.pdf', generationStatus: GenerationStatus.COMPLETED },
        payment.id,
      );

      expect(marked).toBe(true);
      const stored = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
      expect(stored).toMatchObject({
        paymentStatus: PaymentStatus.PAID,
        pdfKey: 'productos/plan.pdf',
        generationStatus: GenerationStatus.COMPLETED,
      });
      expect(stored.paymentDate).toBeInstanceOf(Date);
      expect(await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } })).toMatchObject({
        status: PaymentTransactionStatus.AUTHORIZED,
        authorizationCode: '1213',
      });
    });

    it('sin paymentId crea la fila del pago (pago simulado)', async () => {
      const order = await createOrder(prisma, refs);

      await datasource.markOrderAsPaidWithPayment(order.id, paymentResult());

      expect(await prisma.payment.count({ where: { orderId: order.id } })).toBe(1);
    });

    it('con confirmaciones concurrentes solo una marca la orden y se registra un solo pago', async () => {
      const order = await createOrder(prisma, refs);

      const results = await Promise.all(
        Array.from({ length: 8 }, () =>
          datasource.markOrderAsPaidWithPayment(order.id, paymentResult()),
        ),
      );

      expect(results.filter(Boolean)).toHaveLength(1);
      expect(await prisma.payment.count({ where: { orderId: order.id } })).toBe(1);
    });

    it('pago y rechazo concurrentes dejan un único resultado coherente', async () => {
      const order = await createOrder(prisma, refs);

      const [paid] = await Promise.all([
        datasource.markOrderAsPaidWithPayment(order.id, paymentResult()),
        datasource.markOrderAsRejectedWithPayment(
          order.id,
          paymentResult(PaymentTransactionStatus.REJECTED),
        ),
      ]);

      // Un rechazo previo deja la orden pagable, así que el pago siempre gana y nunca retrocede.
      expect(paid).toBe(true);
      const stored = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
      expect(stored.paymentStatus).toBe(PaymentStatus.PAID);
    });

    it('si el intento ya no está INITIATED lanza y deshace el cambio de la orden', async () => {
      const order = await createOrder(prisma, refs);
      const payment = await initiatedPayment(order.id);
      await prisma.payment.update({
        where: { id: payment.id },
        data: { status: PaymentTransactionStatus.CANCELLED },
      });

      await expect(
        datasource.markOrderAsPaidWithPayment(order.id, paymentResult(), {}, payment.id),
      ).rejects.toThrow('ya no estaba INITIATED');

      const stored = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
      expect(stored.paymentStatus).toBe(PaymentStatus.PENDING);
      expect(stored.paymentDate).toBeNull();
    });

    it('no acepta un intento de pago de otra orden', async () => {
      const order = await createOrder(prisma, refs);
      const other = await createOrder(prisma, refs);
      const foreignPayment = await initiatedPayment(other.id);

      await expect(
        datasource.markOrderAsPaidWithPayment(order.id, paymentResult(), {}, foreignPayment.id),
      ).rejects.toThrow();

      const stored = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
      expect(stored.paymentStatus).toBe(PaymentStatus.PENDING);
      expect(
        (await prisma.payment.findUniqueOrThrow({ where: { id: foreignPayment.id } })).status,
      ).toBe(PaymentTransactionStatus.INITIATED);
    });

    it.each([
      ['ya pagada', { paymentStatus: PaymentStatus.PAID }],
      ['expirada por estado', { paymentStatus: PaymentStatus.EXPIRED }],
      ['con el plazo vencido', { expirationDate: hoursFromNow(-1) }],
    ])('devuelve false y no registra pago si la orden está %s', async (_name, data) => {
      const order = await createOrder(prisma, refs, data);

      expect(await datasource.markOrderAsPaidWithPayment(order.id, paymentResult())).toBe(false);
      expect(await prisma.payment.count({ where: { orderId: order.id } })).toBe(0);
    });

    it.each([
      ['sin plazo', { expirationDate: null }],
      ['rechazada antes (reintento)', { paymentStatus: PaymentStatus.REJECTED }],
    ])('acepta una orden %s', async (_name, data) => {
      const order = await createOrder(prisma, refs, data);

      expect(await datasource.markOrderAsPaidWithPayment(order.id, paymentResult())).toBe(true);
    });
  });

  describe('markOrderAsRejectedWithPayment', () => {
    it('rechaza la orden y cierra el intento, sin fijar fecha de pago', async () => {
      const order = await createOrder(prisma, refs);
      const payment = await initiatedPayment(order.id);

      const rejected = await datasource.markOrderAsRejectedWithPayment(
        order.id,
        paymentResult(PaymentTransactionStatus.REJECTED),
        payment.id,
      );

      expect(rejected).toBe(true);
      const stored = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
      expect(stored.paymentStatus).toBe(PaymentStatus.REJECTED);
      expect(stored.paymentDate).toBeNull();
      expect((await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } })).status).toBe(
        PaymentTransactionStatus.REJECTED,
      );
    });

    it('no pisa una orden ya pagada', async () => {
      const order = await createOrder(prisma, refs, { paymentStatus: PaymentStatus.PAID });

      const rejected = await datasource.markOrderAsRejectedWithPayment(
        order.id,
        paymentResult(PaymentTransactionStatus.REJECTED),
      );

      expect(rejected).toBe(false);
      const stored = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
      expect(stored.paymentStatus).toBe(PaymentStatus.PAID);
    });
  });

  describe('expiración', () => {
    it('expireOrderIfDue expira en el límite exacto del plazo, una sola vez', async () => {
      const now = new Date();
      const order = await createOrder(prisma, refs, { expirationDate: now });

      expect(await datasource.expireOrderIfDue(order.id, now)).toBe(true);
      expect(await datasource.expireOrderIfDue(order.id, now)).toBe(false);
    });

    it.each([
      ['con plazo vigente', { expirationDate: hoursFromNow(1) }],
      ['sin plazo', { expirationDate: null }],
      ['pagada', { expirationDate: hoursFromNow(-1), paymentStatus: PaymentStatus.PAID }],
    ])('expireOrderIfDue no toca una orden %s', async (_name, data) => {
      const order = await createOrder(prisma, refs, data);

      expect(await datasource.expireOrderIfDue(order.id, new Date())).toBe(false);
    });

    it('un pago y una expiración concurrentes nunca dejan dos resultados', async () => {
      // El plazo sigue vigente para el pago y vencido para el job: lo decide el bloqueo de la fila.
      const order = await createOrder(prisma, refs, { expirationDate: hoursFromNow(1) });

      const [paid, expired] = await Promise.all([
        datasource.markOrderAsPaidWithPayment(order.id, paymentResult()),
        datasource.expireOrderIfDue(order.id, hoursFromNow(2)),
      ]);

      expect([paid, expired].filter(Boolean)).toHaveLength(1);
      const stored = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
      expect(stored.paymentStatus).toBe(paid ? PaymentStatus.PAID : PaymentStatus.EXPIRED);
      expect(await prisma.payment.count({ where: { orderId: order.id } })).toBe(paid ? 1 : 0);
    });

    it('getDueUnpaidOrderIds devuelve las vencidas sin pagar, las más antiguas primero y con tope', async () => {
      const oldest = await createOrder(prisma, refs, { expirationDate: hoursFromNow(-3) });
      const rejected = await createOrder(prisma, refs, {
        expirationDate: hoursFromNow(-2),
        paymentStatus: PaymentStatus.REJECTED,
      });
      await createOrder(prisma, refs, { expirationDate: hoursFromNow(-1) });
      await createOrder(prisma, refs, {
        expirationDate: hoursFromNow(-5),
        paymentStatus: PaymentStatus.PAID,
      });
      await createOrder(prisma, refs, { expirationDate: hoursFromNow(1) });

      expect(await datasource.getDueUnpaidOrderIds(new Date(), 2)).toEqual([oldest.id, rejected.id]);
    });
  });

  describe('generación del plan', () => {
    it('con transiciones concurrentes solo una pasa a GENERATING', async () => {
      const order = await createOrder(prisma, refs, { paymentStatus: PaymentStatus.PAID });

      const results = await Promise.all(
        Array.from({ length: 8 }, () => datasource.tryTransitionOrderToGenerating(order.id)),
      );

      expect(results.filter(Boolean)).toHaveLength(1);
    });

    it('tryTransitionOrderToGenerating admite un reintento desde ERROR pero no desde COMPLETED', async () => {
      const failed = await createOrder(prisma, refs, { generationStatus: GenerationStatus.ERROR });
      const done = await createOrder(prisma, refs, { generationStatus: GenerationStatus.COMPLETED });

      expect(await datasource.tryTransitionOrderToGenerating(failed.id)).toBe(true);
      expect(await datasource.tryTransitionOrderToGenerating(done.id)).toBe(false);
    });

    it('incrementOrderFailedAttempt suma correctamente con fallos concurrentes', async () => {
      const order = await createOrder(prisma, refs);

      await Promise.all(
        Array.from({ length: 5 }, () => datasource.incrementOrderFailedAttempt(order.id)),
      );

      const stored = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
      expect(stored.attempts).toBe(5);
      expect(stored.generationStatus).toBe(GenerationStatus.ERROR);
    });

    it('releaseStalledGenerations libera solo las GENERATING estancadas y cuenta la ronda', async () => {
      const staleBefore = hoursFromNow(-1);
      const stalled = await createOrder(prisma, refs, {
        generationStatus: GenerationStatus.GENERATING,
        generationUpdatedAt: hoursFromNow(-2),
      });
      const withoutDate = await createOrder(prisma, refs, {
        generationStatus: GenerationStatus.GENERATING,
        generationUpdatedAt: null,
      });
      const running = await createOrder(prisma, refs, {
        generationStatus: GenerationStatus.GENERATING,
        generationUpdatedAt: new Date(),
      });

      expect(await datasource.releaseStalledGenerations(staleBefore)).toBe(2);

      for (const { id } of [stalled, withoutDate]) {
        expect(await prisma.order.findUniqueOrThrow({ where: { id } })).toMatchObject({
          generationStatus: GenerationStatus.ERROR,
          attempts: 1,
          generationUpdatedAt: null,
        });
      }
      expect(
        (await prisma.order.findUniqueOrThrow({ where: { id: running.id } })).generationStatus,
      ).toBe(GenerationStatus.GENERATING);
    });

    it('getOrderIdsPendingGeneration aplica la espera según las rondas fallidas', async () => {
      const paid = { paymentStatus: PaymentStatus.PAID };
      const lostEvent = await createOrder(prisma, refs, {
        ...paid,
        paymentDate: hoursFromNow(-4),
      });
      const dueFirstRetry = await createOrder(prisma, refs, {
        ...paid,
        paymentDate: hoursFromNow(-3),
        generationStatus: GenerationStatus.ERROR,
        attempts: 1,
        generationUpdatedAt: hoursFromNow(-2),
      });
      const dueNoDate = await createOrder(prisma, refs, {
        ...paid,
        paymentDate: hoursFromNow(-2),
        generationStatus: GenerationStatus.ERROR,
        attempts: 2,
        generationUpdatedAt: null,
      });
      // Misma antigüedad que dueFirstRetry, pero con 2 rondas su espera todavía no termina.
      await createOrder(prisma, refs, {
        ...paid,
        paymentDate: hoursFromNow(-3),
        generationStatus: GenerationStatus.ERROR,
        attempts: 2,
        generationUpdatedAt: hoursFromNow(-2),
      });
      // Sin rondas restantes, recién pagada y sin pagar: no se reintentan.
      await createOrder(prisma, refs, {
        ...paid,
        paymentDate: hoursFromNow(-3),
        generationStatus: GenerationStatus.ERROR,
        attempts: 4,
        generationUpdatedAt: hoursFromNow(-3),
      });
      await createOrder(prisma, refs, { ...paid, paymentDate: new Date() });
      await createOrder(prisma, refs, { paymentDate: hoursFromNow(-3) });
      // Un plan predefinido nunca se genera.
      const predefined = await createProduct(prisma, { type: ProductType.PREDEFINED });
      await createOrder(
        prisma,
        { userId: refs.userId, productId: predefined.id },
        { ...paid, paymentDate: hoursFromNow(-3) },
      );

      const ids = await datasource.getOrderIdsPendingGeneration({
        notStartedPaidBefore: hoursFromNow(-1),
        errorRetryDueBefore: [hoursFromNow(-1), hoursFromNow(-4), hoursFromNow(-8)],
        limit: 10,
      });

      expect(ids).toEqual([lostEvent.id, dueFirstRetry.id, dueNoDate.id]);
    });
  });

  describe('lecturas por dueño', () => {
    const ready = {
      paymentStatus: PaymentStatus.PAID,
      generationStatus: GenerationStatus.COMPLETED,
      pdfKey: 'productos/plan.pdf',
    };

    it('getReadyOrderWithPlanDetailByIdAndUserId no devuelve la orden de otro usuario (R2)', async () => {
      const order = await createOrder(prisma, refs, ready);
      const other = await createUser(prisma);

      expect(
        await datasource.getReadyOrderWithPlanDetailByIdAndUserId(order.id, other.id),
      ).toBeNull();
      expect(
        await datasource.getReadyOrderWithPlanDetailByIdAndUserId(order.id, refs.userId),
      ).toMatchObject({ id: order.id, amount: 4990, product: { type: ProductType.GENERATED } });
    });

    it.each([
      ['sin completar', { ...ready, generationStatus: GenerationStatus.GENERATING }],
      ['sin PDF', { ...ready, pdfKey: null }],
    ])('getReadyOrderWithPlanDetailByIdAndUserId no expone una orden %s', async (_name, data) => {
      const order = await createOrder(prisma, refs, data);

      expect(
        await datasource.getReadyOrderWithPlanDetailByIdAndUserId(order.id, refs.userId),
      ).toBeNull();
    });

    it('getPaidOrdersWithPdfByUserId lista solo los planes listos del usuario, el más nuevo primero', async () => {
      const older = await createOrder(prisma, refs, { ...ready, creationDate: hoursFromNow(-2) });
      const newer = await createOrder(prisma, refs, { ...ready, creationDate: hoursFromNow(-1) });
      await createOrder(prisma, refs, { ...ready, pdfKey: null });
      const other = await createUser(prisma);
      await createOrder(prisma, { userId: other.id, productId: refs.productId }, ready);

      const orders = await datasource.getPaidOrdersWithPdfByUserId(refs.userId);

      expect(orders.map(({ id }) => id)).toEqual([newer.id, older.id]);
    });

    it('convierte los montos Decimal a number sin perder valor', async () => {
      const order = await createOrder(prisma, refs, { amount: '12345.67' });

      const stored = await datasource.getOrderWithProductById(order.id);

      expect(stored?.amount).toBe(12345.67);
      expect(stored?.product?.price).toBe(4990);
    });
  });
});
