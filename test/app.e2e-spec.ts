import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/presentation/filters/http-exception.filter';
import { PrismaService } from '../src/infrastructure/orm/prisma/prisma.service';
import { UserRepository } from '../src/domain/repositories/identity-auth/user.repository';
import { ClinicalRecordRepository } from '../src/domain/repositories/clinical-domain/clinical-record.repository';
import { NutritionalConsultationRepository } from '../src/domain/repositories/clinical-domain/nutritional-consultation.repository';
import { ProductRepository } from '../src/domain/repositories/commercial-domain/product.repository';
import { OrderRepository } from '../src/domain/repositories/commercial-domain/order.repository';
import { OpenaiService } from '../src/presentation/openai/openai.service';
import { EmailService } from '../src/presentation/notifications/email.service';

// e2e "sin Postgres real": todo el pipeline HTTP (routing, ValidationPipe, controllers,
// services, HttpExceptionFilter) corre real; solo se mockea el límite más bajo (los 5
// repositorios que usa OrdersService) más OpenaiService/EmailService (para no llamar a
// servicios externos ni renderizar PDFs), y PrismaService (para que nadie intente conectarse a
// una base de datos real al levantar la app).
describe('App (e2e)', () => {
  let app: INestApplication;
  let orderRepository: jest.Mocked<OrderRepository>;
  let userRepository: jest.Mocked<UserRepository>;
  let clinicalRecordRepository: jest.Mocked<ClinicalRecordRepository>;
  let nutritionalConsultationRepository: jest.Mocked<NutritionalConsultationRepository>;
  let productRepository: jest.Mocked<ProductRepository>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue({ $connect: jest.fn(), $disconnect: jest.fn() })
      .overrideProvider(UserRepository)
      .useValue({ findOrCreateUserByEmail: jest.fn() })
      .overrideProvider(ClinicalRecordRepository)
      .useValue({ findOrCreateClinicalRecordByPatientId: jest.fn() })
      .overrideProvider(NutritionalConsultationRepository)
      .useValue({
        countNutritionalConsultationsByClinicalRecordId: jest.fn(),
        createNutritionalConsultationWithDetails: jest.fn(),
        getNutritionalConsultationWithDetailsByOrderId: jest.fn(),
      })
      .overrideProvider(ProductRepository)
      .useValue({ findOrCreateActiveGeneratedProduct: jest.fn() })
      .overrideProvider(OrderRepository)
      .useValue({
        createOrder: jest.fn(),
        getOrderById: jest.fn(),
        getOrderWithUserById: jest.fn(),
        markOrderAsPaidIfPending: jest.fn(),
        tryTransitionOrderToGenerating: jest.fn(),
        updateOrderById: jest.fn(),
        incrementOrderFailedAttempt: jest.fn(),
      })
      .overrideProvider(OpenaiService)
      .useValue({ chatJson: jest.fn() })
      .overrideProvider(EmailService)
      .useValue({ sendPlanByEmail: jest.fn() })
      .compile();

    app = moduleFixture.createNestApplication();
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

    userRepository = moduleFixture.get(UserRepository);
    clinicalRecordRepository = moduleFixture.get(ClinicalRecordRepository);
    nutritionalConsultationRepository = moduleFixture.get(NutritionalConsultationRepository);
    productRepository = moduleFixture.get(ProductRepository);
    orderRepository = moduleFixture.get(OrderRepository);
  });

  afterAll(async () => {
    await app.close();
  });

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

  describe('POST /ordenes/crear', () => {
    it('con payload válido, crea la orden y devuelve 201 + orderId', async () => {
      userRepository.findOrCreateUserByEmail.mockResolvedValue({ id: 'user-1' } as any);
      clinicalRecordRepository.findOrCreateClinicalRecordByPatientId.mockResolvedValue({
        id: 'clinical-1',
      } as any);
      productRepository.findOrCreateActiveGeneratedProduct.mockResolvedValue({
        id: 'product-1',
        price: 10000,
        currency: 'CLP',
      } as any);
      orderRepository.createOrder.mockResolvedValue({ id: 'order-1' } as any);
      nutritionalConsultationRepository.countNutritionalConsultationsByClinicalRecordId.mockResolvedValue(0);
      nutritionalConsultationRepository.createNutritionalConsultationWithDetails.mockResolvedValue({} as any);

      const response = await request(app.getHttpServer())
        .post('/ordenes/crear')
        .send({ personalInfo: validPersonalInfo, anamnesis: null, measurements: null })
        .expect(201);

      expect(response.body).toEqual({ orderId: 'order-1' });
    });

    it('sin email de contacto, devuelve 400', async () => {
      const response = await request(app.getHttpServer())
        .post('/ordenes/crear')
        .send({
          personalInfo: { ...validPersonalInfo, email: undefined },
          anamnesis: null,
          measurements: null,
        })
        .expect(400);

      expect(response.body.statusCode).toBe(400);
    });

    it('con una propiedad desconocida en el body, devuelve 400 (forbidNonWhitelisted)', async () => {
      await request(app.getHttpServer())
        .post('/ordenes/crear')
        .send({
          personalInfo: validPersonalInfo,
          anamnesis: null,
          measurements: null,
          propiedadInventada: true,
        })
        .expect(400);
    });
  });

  describe('GET /ordenes/obtener-estado/:id', () => {
    it('devuelve el estado de la orden mockeada', async () => {
      orderRepository.getOrderById.mockResolvedValue({
        paymentStatus: 'PAID',
        generationStatus: 'COMPLETED',
        planJson: null,
      } as any);

      const response = await request(app.getHttpServer())
        .get('/ordenes/obtener-estado/11111111-1111-4111-8111-111111111111')
        .expect(200);

      expect(response.body).toEqual({
        paymentStatus: 'PAID',
        generationStatus: 'COMPLETED',
        planJson: null,
      });
    });

    it('con un id que no es UUID v4, devuelve 400', async () => {
      await request(app.getHttpServer()).get('/ordenes/obtener-estado/no-es-un-uuid').expect(400);
    });

    it('si la orden no existe, devuelve 404', async () => {
      orderRepository.getOrderById.mockResolvedValue(null);

      await request(app.getHttpServer())
        .get('/ordenes/obtener-estado/22222222-2222-4222-8222-222222222222')
        .expect(404);
    });
  });

  describe('POST /webhooks/pago', () => {
    it('marca la orden como pagada la primera vez, e idempotente la segunda', async () => {
      orderRepository.getOrderById.mockResolvedValue({ id: 'order-1' } as any);
      orderRepository.markOrderAsPaidIfPending.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
      orderRepository.tryTransitionOrderToGenerating.mockResolvedValue(false); // corta el pipeline de generación acá

      const first = await request(app.getHttpServer())
        .post('/webhooks/pago')
        .send({ orden_id: '33333333-3333-4333-8333-333333333333' })
        .expect(201);
      expect(first.body).toEqual({ status: 'procesado' });

      const second = await request(app.getHttpServer())
        .post('/webhooks/pago')
        .send({ orden_id: '33333333-3333-4333-8333-333333333333' })
        .expect(201);
      expect(second.body).toEqual({ status: 'ya_procesado' });
    });

    it('con un orden_id que no es UUID v4, devuelve 400', async () => {
      await request(app.getHttpServer())
        .post('/webhooks/pago')
        .send({ orden_id: 'no-es-un-uuid' })
        .expect(400);
    });
  });
});
