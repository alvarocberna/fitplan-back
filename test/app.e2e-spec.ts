import {
  ExecutionContext,
  INestApplication,
  UnauthorizedException,
  ValidationPipe,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { API_PREFIX } from '../src/common/api-prefix';
import { CognitoAuthGuard } from '../src/common/auth/cognito-auth.guard';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { PrismaService } from '../src/infrastructure/persistence/orm/prisma/prisma.service';
import { AuthIdentityRepository } from '../src/domain/repositories/identity-auth/auth-identity.repository';
import { UserRepository } from '../src/domain/repositories/identity-auth/user.repository';
import { ClinicalRecordRepository } from '../src/domain/repositories/clinical-domain/clinical-record.repository';
import { NutritionalConsultationRepository } from '../src/domain/repositories/clinical-domain/nutritional-consultation.repository';
import { MeasurementsRepository } from '../src/domain/repositories/clinical-domain/measurements.repository';
import { ProductRepository } from '../src/domain/repositories/commercial-domain/product.repository';
import { OrderRepository } from '../src/domain/repositories/commercial-domain/order.repository';
import {
  EmailSender,
  FileStorage,
  LlmProvider,
  PlanDocumentRenderer,
} from '../src/domain/ports';

// e2e "sin Postgres real": todo el pipeline HTTP (prefijo /api/v1, routing, ValidationPipe,
// controllers, casos de uso, evento order.paid, HttpExceptionFilter) corre real; solo se mockea el
// límite más bajo (repositorios y puertos hacia servicios externos), PrismaService (para que nadie
// intente conectarse a una base de datos) y el guard de Cognito (el token se da por válido si viene
// un header Authorization, con sub fijo).
describe('App (e2e)', () => {
  let app: INestApplication;
  let authIdentityRepository: jest.Mocked<AuthIdentityRepository>;
  let userRepository: jest.Mocked<UserRepository>;
  let clinicalRecordRepository: jest.Mocked<ClinicalRecordRepository>;
  let nutritionalConsultationRepository: jest.Mocked<NutritionalConsultationRepository>;
  let productRepository: jest.Mocked<ProductRepository>;
  let orderRepository: jest.Mocked<OrderRepository>;
  let measurementsRepository: jest.Mocked<MeasurementsRepository>;
  let fileStorage: { getSignedDownloadUrl: jest.Mock };

  const api = (path: string) => `/${API_PREFIX}${path}`;
  const AUTH = { Authorization: 'Bearer token-e2e' };
  const completeUser = {
    id: 'user-1',
    email: 'ana@example.com',
    rut: null,
    rutCheckDigit: null,
    firstName: 'Ana',
    middleName: null,
    paternalLastName: 'Pérez',
    maternalLastName: null,
    gender: 'F',
    dateOfBirth: new Date('1996-01-01'),
    photoUrl: null,
    athlete: false,
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideGuard(CognitoAuthGuard)
      .useValue({
        canActivate: (context: ExecutionContext) => {
          const req = context.switchToHttp().getRequest();
          if (!req.headers['authorization']) {
            throw new UnauthorizedException('Falta el token de autenticación');
          }
          req.cognitoUser = { sub: 'sub-1' };
          return true;
        },
      })
      .overrideProvider(PrismaService)
      .useValue({ $connect: jest.fn(), $disconnect: jest.fn() })
      .overrideProvider(AuthIdentityRepository)
      .useValue({ findAuthIdentityByProvider: jest.fn(), createAuthIdentity: jest.fn() })
      .overrideProvider(UserRepository)
      .useValue({ getUserById: jest.fn(), findOrCreateUserByEmail: jest.fn(), updateUserById: jest.fn() })
      .overrideProvider(ClinicalRecordRepository)
      .useValue({ findOrCreateClinicalRecordByPatientId: jest.fn() })
      .overrideProvider(NutritionalConsultationRepository)
      .useValue({
        getMaxConsultationNumberByClinicalRecordId: jest.fn(),
        createNutritionalConsultationWithDetails: jest.fn(),
        getNutritionalConsultationWithDetailsByOrderId: jest.fn(),
        getLatestNutritionalConsultationWithDetailsByPatientId: jest.fn(),
        getNutritionalConsultationsWithStatusByPatientId: jest.fn(),
        getNutritionalConsultationDetailByIdAndPatientId: jest.fn(),
        deleteNutritionalConsultationByOrderId: jest.fn(),
      })
      .overrideProvider(MeasurementsRepository)
      .useValue({
        getLatestMeasurementsWithResultsByPatientId: jest.fn(),
        listMeasurementsByPatientId: jest.fn(),
        getMeasurementDetailByIdAndPatientId: jest.fn(),
        getMaxMeasurementNumberByClinicalRecordId: jest.fn(),
        createMeasurementWithDetails: jest.fn(),
        updateMeasurementWithDetails: jest.fn(),
      })
      .overrideProvider(ProductRepository)
      .useValue({
        findOrCreateActiveGeneratedProduct: jest.fn(),
        getActivePredefinedProductByCode: jest.fn(),
        getActivePlanPreviews: jest.fn(),
      })
      .overrideProvider(OrderRepository)
      .useValue({
        createOrder: jest.fn(),
        getOrderById: jest.fn(),
        getOrderWithUserById: jest.fn(),
        getOrderWithProductById: jest.fn(),
        getPaidOrdersWithPdfByUserId: jest.fn(),
        getReadyOrderWithPlanDetailByIdAndUserId: jest.fn(),
        markOrderAsPaidWithPayment: jest.fn(),
        markOrderAsRejectedWithPayment: jest.fn(),
        expireOrderIfDue: jest.fn(),
        getDueUnpaidOrderIds: jest.fn(),
        releaseStalledGenerations: jest.fn(),
        getOrderIdsPendingGeneration: jest.fn(),
        tryTransitionOrderToGenerating: jest.fn(),
        updateOrderById: jest.fn(),
        incrementOrderFailedAttempt: jest.fn(),
      })
      .overrideProvider(LlmProvider)
      .useValue({ chatJson: jest.fn() })
      .overrideProvider(EmailSender)
      .useValue({ sendPlanByEmail: jest.fn() })
      .overrideProvider(PlanDocumentRenderer)
      .useValue({ renderPdf: jest.fn(), renderThumbnail: jest.fn() })
      .overrideProvider(FileStorage)
      .useValue({ uploadPdf: jest.fn(), uploadImage: jest.fn(), getSignedDownloadUrl: jest.fn() })
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix(API_PREFIX);
    app.useGlobalFilters(new HttpExceptionFilter());
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    await app.init();

    authIdentityRepository = moduleFixture.get(AuthIdentityRepository);
    userRepository = moduleFixture.get(UserRepository);
    clinicalRecordRepository = moduleFixture.get(ClinicalRecordRepository);
    nutritionalConsultationRepository = moduleFixture.get(NutritionalConsultationRepository);
    productRepository = moduleFixture.get(ProductRepository);
    orderRepository = moduleFixture.get(OrderRepository);
    measurementsRepository = moduleFixture.get(MeasurementsRepository);
    fileStorage = moduleFixture.get(FileStorage);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    // el sub del token siempre resuelve a completeUser (R1)
    authIdentityRepository.findAuthIdentityByProvider.mockResolvedValue({
      id: 'identity-1',
      userId: 'user-1',
    } as any);
    userRepository.getUserById.mockResolvedValue(completeUser as any);
  });

  afterAll(async () => {
    await app.close();
  });

  it('las rutas anteriores (en español y sin prefijo) ya no existen', async () => {
    await request(app.getHttpServer()).post('/ordenes/crear').set(AUTH).expect(404);
    await request(app.getHttpServer()).post(api('/ordenes/crear')).set(AUTH).expect(404);
  });

  describe('GET /me y PATCH /me', () => {
    it('GET /me devuelve el perfil del usuario del token', async () => {
      const response = await request(app.getHttpServer()).get(api('/me')).set(AUTH).expect(200);

      expect(response.body).toMatchObject({
        email: 'ana@example.com',
        firstName: 'Ana',
        profileComplete: true,
      });
    });

    it('sin token devuelve 401', async () => {
      await request(app.getHttpServer()).get(api('/me')).expect(401);
    });

    it('PATCH /me acepta un body parcial y actualiza solo esos campos', async () => {
      userRepository.updateUserById.mockResolvedValue({ ...completeUser, athlete: true } as any);

      const response = await request(app.getHttpServer())
        .patch(api('/me'))
        .set(AUTH)
        .send({ athlete: true })
        .expect(200);

      expect(userRepository.updateUserById).toHaveBeenCalledWith('user-1', { athlete: true });
      expect(response.body.athlete).toBe(true);
    });
  });

  describe('GET /me/consultations', () => {
    it('devuelve las consultas del usuario del token con el estado de su plan', async () => {
      nutritionalConsultationRepository.getNutritionalConsultationsWithStatusByPatientId.mockResolvedValue([
        {
          id: 'c-1',
          consultationNumber: 1,
          consultationDate: new Date('2026-03-15T12:00:00.000Z'),
          orderId: 'order-1',
          order: { id: 'order-1', paymentStatus: 'PENDING', generationStatus: 'NOT_STARTED' },
          anamneses: [{ goals: [{ mainGoal: 'bajar de peso' }] }],
          plans: [],
        },
      ] as any);

      const response = await request(app.getHttpServer()).get(api('/me/consultations')).set(AUTH).expect(200);

      expect(nutritionalConsultationRepository.getNutritionalConsultationsWithStatusByPatientId).toHaveBeenCalledWith(
        'user-1',
      );
      expect(response.body).toEqual([
        {
          consultationId: 'c-1',
          consultationNumber: 1,
          consultationDate: '2026-03-15T12:00:00.000Z',
          mainGoal: 'bajar de peso',
          planStatus: 'awaiting_payment',
          orderId: 'order-1',
          plan: null,
        },
      ]);
    });

    it('sin token devuelve 401', async () => {
      await request(app.getHttpServer()).get(api('/me/consultations')).expect(401);
    });
  });

  describe('GET /me/consultations/:consultationId', () => {
    const consultationId = '6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b';

    it('devuelve el detalle de una consulta del usuario del token', async () => {
      nutritionalConsultationRepository.getNutritionalConsultationDetailByIdAndPatientId.mockResolvedValue({
        id: consultationId,
        consultationNumber: 1,
        consultationDate: new Date('2026-03-15T12:00:00.000Z'),
        orderId: 'order-1',
        order: { id: 'order-1', paymentStatus: 'PENDING', generationStatus: 'NOT_STARTED' },
        anamneses: [{ goals: [{ mainGoal: 'bajar de peso', secondaryGoal: [] }] }],
        measurements: [],
        plans: [],
      } as any);

      const response = await request(app.getHttpServer())
        .get(api(`/me/consultations/${consultationId}`))
        .set(AUTH)
        .expect(200);

      expect(nutritionalConsultationRepository.getNutritionalConsultationDetailByIdAndPatientId).toHaveBeenCalledWith(
        consultationId,
        'user-1',
      );
      expect(response.body).toMatchObject({
        consultationId,
        goals: { mainGoal: 'bajar de peso', secondaryGoals: [] },
        planStatus: 'awaiting_payment',
        measurements: [],
        plan: null,
      });
    });

    it('si la consulta no existe o es de otro usuario devuelve 404 (BOLA)', async () => {
      nutritionalConsultationRepository.getNutritionalConsultationDetailByIdAndPatientId.mockResolvedValue(null);

      await request(app.getHttpServer()).get(api(`/me/consultations/${consultationId}`)).set(AUTH).expect(404);
    });

    it('con un id que no es UUID v4 devuelve 400', async () => {
      await request(app.getHttpServer()).get(api('/me/consultations/no-es-uuid')).set(AUTH).expect(400);
    });
  });

  describe('POST /consultations', () => {
    const validPersonalInfo = {
      rut: 12345678,
      dvRut: '5',
      firstName: 'Ana',
      middleName: null,
      paternalLastName: 'Pérez',
      maternalLastName: null,
      gender: 'F',
      athlete: false,
      email: 'ana@example.com',
      dateOfBirth: '1996-01-01',
    };
    const measurements = { weight: 70, height: 175, somatotype: null };

    it('con payload válido crea la consulta y su orden, y devuelve 201 + orderId', async () => {
      clinicalRecordRepository.findOrCreateClinicalRecordByPatientId.mockResolvedValue({
        id: 'clinical-1',
      } as any);
      productRepository.findOrCreateActiveGeneratedProduct.mockResolvedValue({
        id: 'product-1',
        price: 10000,
        currency: 'CLP',
      } as any);
      orderRepository.createOrder.mockResolvedValue({ id: 'order-1' } as any);
      nutritionalConsultationRepository.getMaxConsultationNumberByClinicalRecordId.mockResolvedValue(0);
      nutritionalConsultationRepository.createNutritionalConsultationWithDetails.mockResolvedValue({} as any);

      const response = await request(app.getHttpServer())
        .post(api('/consultations'))
        .set(AUTH)
        .send({ personalInfo: validPersonalInfo, anamnesis: {}, measurements })
        .expect(201);

      expect(response.body).toEqual({ orderId: 'order-1' });
    });

    it('con una propiedad desconocida en el body devuelve 400 (forbidNonWhitelisted)', async () => {
      await request(app.getHttpServer())
        .post(api('/consultations'))
        .set(AUTH)
        .send({
          personalInfo: validPersonalInfo,
          anamnesis: {},
          measurements,
          propiedadInventada: true,
        })
        .expect(400);
    });
  });

  describe('/me/measurements', () => {
    const measurementId = '8b1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b';
    const measurement = {
      id: measurementId,
      measurementNumber: 1,
      measuredAt: new Date('2026-05-10T12:00:00.000Z'),
      level: 'BASIC',
      consultationId: null,
      basicMeasurements: [{ weight: 70, height: 172 }],
      skinfolds: [],
      circumferences: [],
      diameters: [],
      measurementResults: [],
    };

    it('GET /me/measurements lista las mediciones del usuario del token', async () => {
      measurementsRepository.listMeasurementsByPatientId.mockResolvedValue([measurement] as any);

      const response = await request(app.getHttpServer()).get(api('/me/measurements')).set(AUTH).expect(200);

      expect(measurementsRepository.listMeasurementsByPatientId).toHaveBeenCalledWith('user-1', {
        from: undefined,
        to: undefined,
      });
      expect(response.body).toEqual([
        expect.objectContaining({ measurementId, origin: 'SELF_REPORTED', weight: 70, bmi: null }),
      ]);
    });

    it('GET /me/measurements/:id devuelve el detalle, o 404 si no existe o es de otro usuario (BOLA)', async () => {
      measurementsRepository.getMeasurementDetailByIdAndPatientId.mockResolvedValueOnce(measurement as any);
      const response = await request(app.getHttpServer())
        .get(api(`/me/measurements/${measurementId}`))
        .set(AUTH)
        .expect(200);
      expect(response.body).toMatchObject({ measurementId, raw: { basic: { weight: 70, height: 172 } }, results: [] });

      measurementsRepository.getMeasurementDetailByIdAndPatientId.mockResolvedValueOnce(null);
      await request(app.getHttpServer()).get(api(`/me/measurements/${measurementId}`)).set(AUTH).expect(404);
    });

    it('POST /me/measurements registra una medición en el historial del usuario y devuelve 201 con el detalle', async () => {
      clinicalRecordRepository.findOrCreateClinicalRecordByPatientId.mockResolvedValue({ id: 'cr-1' } as any);
      measurementsRepository.getMaxMeasurementNumberByClinicalRecordId.mockResolvedValue(0);
      measurementsRepository.createMeasurementWithDetails.mockResolvedValue({ id: measurementId } as any);
      measurementsRepository.getMeasurementDetailByIdAndPatientId.mockResolvedValue(measurement as any);

      const response = await request(app.getHttpServer())
        .post(api('/me/measurements'))
        .set(AUTH)
        .send({ level: 'BASIC', measuredAt: '2026-05-10T12:00:00.000Z', weight: 70, height: 172 })
        .expect(201);

      expect(measurementsRepository.createMeasurementWithDetails).toHaveBeenCalledWith(
        expect.objectContaining({ clinicalRecordId: 'cr-1', measurementNumber: 1, level: 'BASIC' }),
      );
      expect(response.body).toMatchObject({ measurementId, editable: true });
    });

    it('POST /me/measurements con un body inválido devuelve 400 sin escribir nada', async () => {
      await request(app.getHttpServer())
        .post(api('/me/measurements'))
        .set(AUTH)
        .send({ level: 'ISAK_1', weight: 5, height: 172 })
        .expect(400);
      expect(measurementsRepository.createMeasurementWithDetails).not.toHaveBeenCalled();
    });

    it('PATCH /me/measurements/:id corrige la medición', async () => {
      measurementsRepository.getMeasurementDetailByIdAndPatientId.mockResolvedValue(measurement as any);

      await request(app.getHttpServer())
        .patch(api(`/me/measurements/${measurementId}`))
        .set(AUTH)
        .send({ weight: 69 })
        .expect(200);

      expect(measurementsRepository.updateMeasurementWithDetails).toHaveBeenCalledWith(
        measurementId,
        expect.objectContaining({ basic: { weight: 69 } }),
      );
    });

    it('sin token devuelve 401', async () => {
      await request(app.getHttpServer()).get(api('/me/measurements')).expect(401);
    });
  });

  describe('GET /me/plans y GET /me/plans/:orderId', () => {
    const orderId = '7a1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b';
    const predefinedOrder = {
      id: orderId,
      creationDate: new Date('2026-01-01T00:00:00.000Z'),
      paymentDate: new Date('2026-01-02T10:00:00.000Z'),
      pdfKey: 'productos-estandarizados/plan-running.pdf',
      thumbnailKey: null,
      planJson: null,
      product: {
        type: 'PREDEFINED',
        name: 'Plan Running',
        description: 'Plan para corredores',
        goal: null,
        dietRegimen: null,
        calorieIntake: null,
        proteinIntake: null,
        carbohydrateIntake: null,
        lipidIntake: null,
      },
      plan: null,
    };

    beforeEach(() => {
      fileStorage.getSignedDownloadUrl.mockResolvedValue('https://signed.example/plan.pdf');
    });

    it('GET /me/plans lista los planes del usuario del token con tipo, nombre y URL de descarga', async () => {
      orderRepository.getPaidOrdersWithPdfByUserId.mockResolvedValue([predefinedOrder] as any);

      const response = await request(app.getHttpServer()).get(api('/me/plans')).set(AUTH).expect(200);

      expect(orderRepository.getPaidOrdersWithPdfByUserId).toHaveBeenCalledWith('user-1');
      expect(response.body).toEqual([
        {
          orderId,
          type: 'PREDEFINED',
          name: 'Plan Running',
          purchasedAt: '2026-01-02T10:00:00.000Z',
          pdfUrl: 'https://signed.example/plan.pdf',
          thumbnailUrl: null,
          summary: null,
        },
      ]);
    });

    it('GET /me/plans/:orderId devuelve el detalle del plan del usuario del token', async () => {
      orderRepository.getReadyOrderWithPlanDetailByIdAndUserId.mockResolvedValue(predefinedOrder as any);

      const response = await request(app.getHttpServer()).get(api(`/me/plans/${orderId}`)).set(AUTH).expect(200);

      expect(orderRepository.getReadyOrderWithPlanDetailByIdAndUserId).toHaveBeenCalledWith(orderId, 'user-1');
      expect(response.body).toMatchObject({
        orderId,
        type: 'PREDEFINED',
        generated: null,
        predefined: { description: 'Plan para corredores', summary: null },
      });
    });

    it('GET /me/plans/:orderId responde 404 si el plan no existe, es de otro usuario o no está listo (BOLA)', async () => {
      orderRepository.getReadyOrderWithPlanDetailByIdAndUserId.mockResolvedValue(null);

      await request(app.getHttpServer()).get(api(`/me/plans/${orderId}`)).set(AUTH).expect(404);
    });

    it('GET /me/plans/:orderId con un id que no es UUID v4 devuelve 400', async () => {
      await request(app.getHttpServer()).get(api('/me/plans/no-es-uuid')).set(AUTH).expect(400);
    });

    it('sin token devuelve 401', async () => {
      await request(app.getHttpServer()).get(api(`/me/plans/${orderId}`)).expect(401);
    });
  });

  describe('GET /orders/:id/status', () => {
    it('devuelve el estado de la orden del usuario', async () => {
      orderRepository.getOrderById.mockResolvedValue({
        userId: 'user-1',
        paymentStatus: 'PAID',
        generationStatus: 'COMPLETED',
        planJson: null,
        pdfKey: null,
        thumbnailKey: null,
        creationDate: new Date('2026-01-01'),
      } as any);

      const response = await request(app.getHttpServer())
        .get(api('/orders/11111111-1111-4111-8111-111111111111/status'))
        .set(AUTH)
        .expect(200);

      expect(response.body).toEqual({
        paymentStatus: 'PAID',
        expirationDate: null,
        generationStatus: 'COMPLETED',
        planJson: null,
        pdfUrl: null,
        thumbnailUrl: null,
      });
    });

    it('con un id que no es UUID v4 devuelve 400', async () => {
      await request(app.getHttpServer())
        .get(api('/orders/no-es-un-uuid/status'))
        .set(AUTH)
        .expect(400);
    });

    it('si la orden es de otro usuario devuelve 404 (BOLA)', async () => {
      orderRepository.getOrderById.mockResolvedValue({ userId: 'otro-usuario' } as any);

      await request(app.getHttpServer())
        .get(api('/orders/22222222-2222-4222-8222-222222222222/status'))
        .set(AUTH)
        .expect(404);
    });
  });

  describe('POST /webhooks/payments', () => {
    const orderId = '33333333-3333-4333-8333-333333333333';

    it('marca la orden como pagada la primera vez, dispara la generación (order.paid) y es idempotente la segunda', async () => {
      orderRepository.getOrderWithProductById.mockResolvedValue({
        id: orderId,
        amount: 10000,
        product: { id: 'product-1', type: 'GENERATED', pdfKey: null, thumbnailKey: null },
      } as any);
      orderRepository.markOrderAsPaidWithPayment.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
      orderRepository.tryTransitionOrderToGenerating.mockResolvedValue(false); // corta el pipeline de generación acá

      const first = await request(app.getHttpServer())
        .post(api('/webhooks/payments'))
        .send({ orderId })
        .expect(201);
      expect(first.body).toEqual({ status: 'processed' });
      expect(orderRepository.tryTransitionOrderToGenerating).toHaveBeenCalledWith(orderId);

      const second = await request(app.getHttpServer())
        .post(api('/webhooks/payments'))
        .send({ orderId })
        .expect(201);
      expect(second.body).toEqual({ status: 'already_processed' });
      expect(orderRepository.tryTransitionOrderToGenerating).toHaveBeenCalledTimes(1);
    });

    it('con un orderId que no es UUID v4 devuelve 400', async () => {
      await request(app.getHttpServer())
        .post(api('/webhooks/payments'))
        .send({ orderId: 'no-es-un-uuid' })
        .expect(400);
    });

    it('con status REJECTED registra el rechazo y no marca la orden como pagada', async () => {
      orderRepository.getOrderById.mockResolvedValue({
        id: orderId,
        amount: 10000,
        paymentStatus: 'PENDING',
      } as any);
      orderRepository.markOrderAsRejectedWithPayment.mockResolvedValue(true);

      const response = await request(app.getHttpServer())
        .post(api('/webhooks/payments'))
        .send({ orderId, status: 'REJECTED' })
        .expect(201);

      expect(response.body).toEqual({ status: 'rejected' });
      expect(orderRepository.markOrderAsRejectedWithPayment).toHaveBeenCalledWith(
        orderId,
        expect.objectContaining({ status: 'REJECTED', amount: 10000 }),
      );
      expect(orderRepository.markOrderAsPaidWithPayment).not.toHaveBeenCalled();
    });

    it('con un status desconocido devuelve 400', async () => {
      await request(app.getHttpServer())
        .post(api('/webhooks/payments'))
        .send({ orderId, status: 'CANCELLED' })
        .expect(400);
    });

    it('si el plazo de la orden venció responde 409, la expira y borra su consulta (order.expired)', async () => {
      orderRepository.getOrderWithProductById.mockResolvedValue({
        id: orderId,
        amount: 10000,
        paymentStatus: 'PENDING',
        expirationDate: new Date(Date.now() - 60_000),
        product: { id: 'product-1', type: 'GENERATED', pdfKey: null, thumbnailKey: null },
      } as any);
      orderRepository.markOrderAsPaidWithPayment.mockResolvedValue(false);
      orderRepository.expireOrderIfDue.mockResolvedValue(true);
      nutritionalConsultationRepository.deleteNutritionalConsultationByOrderId.mockResolvedValue(true);

      await request(app.getHttpServer())
        .post(api('/webhooks/payments'))
        .send({ orderId })
        .expect(409);

      expect(orderRepository.expireOrderIfDue).toHaveBeenCalledWith(orderId, expect.any(Date));
      expect(
        nutritionalConsultationRepository.deleteNutritionalConsultationByOrderId,
      ).toHaveBeenCalledWith(orderId);
      expect(orderRepository.tryTransitionOrderToGenerating).not.toHaveBeenCalled();
    });
  });

  describe('POST /dev/orders/:id/simulate-payment', () => {
    const orderId = '44444444-4444-4444-8444-444444444444';
    const previous = process.env.ENABLE_PAYMENT_SIMULATION;

    afterEach(() => {
      if (previous === undefined) delete process.env.ENABLE_PAYMENT_SIMULATION;
      else process.env.ENABLE_PAYMENT_SIMULATION = previous;
    });

    it('responde 404 si ENABLE_PAYMENT_SIMULATION no es "true"', async () => {
      delete process.env.ENABLE_PAYMENT_SIMULATION;

      await request(app.getHttpServer())
        .post(api(`/dev/orders/${orderId}/simulate-payment`))
        .expect(404);
      expect(orderRepository.markOrderAsPaidWithPayment).not.toHaveBeenCalled();
    });

    it('con ENABLE_PAYMENT_SIMULATION=true procesa el pago', async () => {
      process.env.ENABLE_PAYMENT_SIMULATION = 'true';
      orderRepository.getOrderWithProductById.mockResolvedValue({
        id: orderId,
        amount: 14990,
        product: {
          id: 'product-2',
          type: 'PREDEFINED',
          pdfKey: 'productos-estandarizados/plan.pdf',
          thumbnailKey: null,
        },
      } as any);
      orderRepository.markOrderAsPaidWithPayment.mockResolvedValue(true);

      const response = await request(app.getHttpServer())
        .post(api(`/dev/orders/${orderId}/simulate-payment`))
        .expect(201);

      expect(response.body).toEqual({ status: 'processed' });
      // un plan estándar no dispara la generación
      expect(orderRepository.tryTransitionOrderToGenerating).not.toHaveBeenCalled();
    });

    it('simulate-payment-rejection: 404 sin el flag y, con él, deja la orden rechazada', async () => {
      delete process.env.ENABLE_PAYMENT_SIMULATION;
      await request(app.getHttpServer())
        .post(api(`/dev/orders/${orderId}/simulate-payment-rejection`))
        .expect(404);
      expect(orderRepository.markOrderAsRejectedWithPayment).not.toHaveBeenCalled();

      process.env.ENABLE_PAYMENT_SIMULATION = 'true';
      orderRepository.getOrderById.mockResolvedValue({
        id: orderId,
        amount: 14990,
        paymentStatus: 'PENDING',
      } as any);
      orderRepository.markOrderAsRejectedWithPayment.mockResolvedValue(true);

      const response = await request(app.getHttpServer())
        .post(api(`/dev/orders/${orderId}/simulate-payment-rejection`))
        .expect(201);
      expect(response.body).toEqual({ status: 'rejected' });
    });
  });
});
