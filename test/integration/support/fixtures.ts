import { randomUUID } from 'node:crypto';
import { Prisma } from '../../../generated/prisma';
import { PrismaService } from '../../../src/infrastructure/persistence/orm/prisma/prisma.service';
import { ProductType } from '../../../src/domain/entities/enums';

export const HOUR_MS = 60 * 60_000;
export const hoursFromNow = (hours: number) =>
  new Date(Date.now() + hours * HOUR_MS);

export function createUser(prisma: PrismaService) {
  return prisma.user.create({ data: { email: `${randomUUID()}@example.com` } });
}

export function createProduct(
  prisma: PrismaService,
  data: Partial<Prisma.ProductUncheckedCreateInput> = {},
) {
  return prisma.product.create({
    data: {
      type: ProductType.GENERATED,
      name: 'Plan personalizado',
      description: 'Plan de prueba',
      price: 4990,
      currency: 'CLP',
      active: true,
      ...data,
    },
  });
}

// Orden pagable (PENDING, con plazo vigente) salvo que `data` indique otra cosa.
export function createOrder(
  prisma: PrismaService,
  refs: { userId: string; productId: string },
  data: Partial<Prisma.OrderUncheckedCreateInput> = {},
) {
  return prisma.order.create({
    data: {
      ...refs,
      amount: 4990,
      currency: 'CLP',
      creationDate: new Date(),
      expirationDate: hoursFromNow(24),
      ...data,
    },
  });
}

export function createClinicalRecord(prisma: PrismaService, patientId: string) {
  return prisma.clinicalRecord.create({ data: { patientId } });
}

export function createPlanFor(
  prisma: PrismaService,
  consultationId: string,
  orderId: string,
) {
  return prisma.plan.create({ data: { consultationId, orderId } });
}

// Usuario con su historial clínico y una orden: el punto de partida de las pruebas clínicas.
export async function createPatient(prisma: PrismaService) {
  const user = await createUser(prisma);
  const clinicalRecord = await createClinicalRecord(prisma, user.id);
  return { user, clinicalRecord };
}
