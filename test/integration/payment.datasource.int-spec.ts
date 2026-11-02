import { PaymentDatasourceImpl } from '../../src/infrastructure/persistence/datasources/commercial-domain/payment.datasource';
import { PrismaService } from '../../src/infrastructure/persistence/orm/prisma/prisma.service';
import {
  PaymentProvider,
  PaymentTransactionStatus,
} from '../../src/domain/entities/enums';
import { createOrder, createProduct, createUser } from './support/fixtures';
import { createTestPrisma, resetDatabase } from './support/test-database';

describe('PaymentDatasourceImpl (Postgres)', () => {
  let prisma: PrismaService;
  let datasource: PaymentDatasourceImpl;
  let orderId: string;

  const attempt = (overrides = {}) => ({
    orderId,
    provider: PaymentProvider.TRANSBANK,
    paymentIdentifier: 'buy-order-1',
    token: 'token-1',
    amount: 4990,
    status: PaymentTransactionStatus.INITIATED,
    ...overrides,
  });

  beforeAll(async () => {
    prisma = createTestPrisma();
    await prisma.$connect();
    datasource = new PaymentDatasourceImpl(prisma);
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
    const [user, product] = [
      await createUser(prisma),
      await createProduct(prisma),
    ];
    orderId = (
      await createOrder(prisma, { userId: user.id, productId: product.id })
    ).id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('crea el intento y lo encuentra por token, con el monto como number', async () => {
    const created = await datasource.createPayment(attempt({ amount: 1234.5 }));

    expect(created.amount).toBe(1234.5);
    expect(await datasource.getPaymentByToken('token-1')).toMatchObject({
      id: created.id,
      amount: 1234.5,
    });
    expect(await datasource.getPaymentByToken('no-existe')).toBeNull();
  });

  it('la base rechaza dos intentos con el mismo token', async () => {
    await datasource.createPayment(attempt());

    await expect(datasource.createPayment(attempt())).rejects.toMatchObject({
      code: 'P2002',
    });
  });

  it('admite varios intentos sin token (pagos simulados)', async () => {
    await datasource.createPayment(attempt({ token: null }));
    await datasource.createPayment(attempt({ token: null }));

    expect(await prisma.payment.count({ where: { orderId } })).toBe(2);
  });

  it('getPaymentByIdentifier devuelve el intento más reciente de esa orden de compra', async () => {
    await prisma.payment.create({
      data: {
        ...attempt(),
        token: 'old',
        createdAt: new Date('2026-01-01T00:00:00Z'),
      },
    });
    const latest = await prisma.payment.create({
      data: {
        ...attempt(),
        token: 'new',
        createdAt: new Date('2026-01-02T00:00:00Z'),
      },
    });

    expect((await datasource.getPaymentByIdentifier('buy-order-1'))?.id).toBe(
      latest.id,
    );
  });

  describe('closeInitiatedPayment', () => {
    it('cierra el intento una sola vez y no pisa el primer resultado', async () => {
      const { id } = await datasource.createPayment(attempt());

      expect(
        await datasource.closeInitiatedPayment(id, {
          status: PaymentTransactionStatus.CANCELLED,
        }),
      ).toBe(true);
      expect(
        await datasource.closeInitiatedPayment(id, {
          status: PaymentTransactionStatus.REJECTED,
        }),
      ).toBe(false);

      expect((await datasource.getPaymentById(id))?.status).toBe(
        PaymentTransactionStatus.CANCELLED,
      );
    });

    it('con cierres concurrentes solo uno gana', async () => {
      const { id } = await datasource.createPayment(attempt());

      const results = await Promise.all(
        Array.from({ length: 8 }, () =>
          datasource.closeInitiatedPayment(id, {
            status: PaymentTransactionStatus.CANCELLED,
          }),
        ),
      );

      expect(results.filter(Boolean)).toHaveLength(1);
    });
  });
});
