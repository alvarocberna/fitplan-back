import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { AuthIdentityService } from '../auth/auth-identity.service';
import type { CognitoUserClaims } from '../auth/cognito-user.decorator';
import { ClinicalRecordRepository } from '../../domain/repositories/clinical-domain/clinical-record.repository';
import { NutritionalConsultationRepository } from '../../domain/repositories/clinical-domain/nutritional-consultation.repository';
import { ProductRepository } from '../../domain/repositories/commercial-domain/product.repository';
import { OrderRepository } from '../../domain/repositories/commercial-domain/order.repository';
import { CompleteConsultationDtoImpl } from '../consultation/dto/consultation.dto';
import { NutritionPlanDto } from '../../domain';
import { StorageService } from '../storage/storage.service';

describe('OrdersService', () => {
  let service: OrdersService;
  let authIdentityService: jest.Mocked<AuthIdentityService>;
  let clinicalRecordRepository: jest.Mocked<ClinicalRecordRepository>;
  let nutritionalConsultationRepository: jest.Mocked<NutritionalConsultationRepository>;
  let productRepository: jest.Mocked<ProductRepository>;
  let orderRepository: jest.Mocked<OrderRepository>;
  let storageService: jest.Mocked<StorageService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        {
          provide: AuthIdentityService,
          useValue: { getUserBySub: jest.fn(), isProfileComplete: jest.fn() },
        },
        {
          provide: ClinicalRecordRepository,
          useValue: { findOrCreateClinicalRecordByPatientId: jest.fn() },
        },
        {
          provide: NutritionalConsultationRepository,
          useValue: {
            countNutritionalConsultationsByClinicalRecordId: jest.fn(),
            createNutritionalConsultationWithDetails: jest.fn(),
            getNutritionalConsultationWithDetailsByOrderId: jest.fn(),
          },
        },
        {
          provide: ProductRepository,
          useValue: { findOrCreateActiveGeneratedProduct: jest.fn() },
        },
        {
          provide: OrderRepository,
          useValue: {
            createOrder: jest.fn(),
            getOrderById: jest.fn(),
            getOrderWithUserById: jest.fn(),
            getPaidOrdersWithPdfByUserId: jest.fn(),
            markOrderAsPaidIfPending: jest.fn(),
            tryTransitionOrderToGenerating: jest.fn(),
            updateOrderById: jest.fn(),
            incrementOrderFailedAttempt: jest.fn(),
            anonymizeOldOrders: jest.fn(),
          },
        },
        {
          provide: StorageService,
          useValue: { uploadPdf: jest.fn(), getSignedDownloadUrl: jest.fn() },
        },
      ],
    }).compile();

    service = module.get(OrdersService);
    authIdentityService = module.get(AuthIdentityService);
    clinicalRecordRepository = module.get(ClinicalRecordRepository);
    nutritionalConsultationRepository = module.get(NutritionalConsultationRepository);
    productRepository = module.get(ProductRepository);
    orderRepository = module.get(OrderRepository);
    storageService = module.get(StorageService);
  });

  describe('createOrder', () => {
    const cognitoUser: CognitoUserClaims = { sub: 'test-sub' };

    const baseDto: CompleteConsultationDtoImpl = {
      personalInfo: {
        rut: null,
        dvRut: null,
        firstName: 'Ana',
        middleName: null,
        paternalLastName: 'Pérez',
        maternalLastName: null,
        gender: 'F',
        athlete: false,
        email: 'ana@example.com',
        dateOfBirth: new Date('1995-01-01') as unknown as Date,
      },
      anamnesis: null,
      measurements: null,
    } as CompleteConsultationDtoImpl;

    it('lanza BadRequestException si falta personalInfo', async () => {
      const dto = { ...baseDto, personalInfo: null } as CompleteConsultationDtoImpl;
      await expect(service.createOrder(dto, cognitoUser)).rejects.toBeInstanceOf(BadRequestException);
      expect(authIdentityService.getUserBySub).not.toHaveBeenCalled();
    });

    it('lanza BadRequestException si el perfil (User) está incompleto', async () => {
      authIdentityService.getUserBySub.mockResolvedValue({ id: 'user-1' } as any);
      authIdentityService.isProfileComplete.mockReturnValue(false);

      await expect(service.createOrder(baseDto, cognitoUser)).rejects.toBeInstanceOf(BadRequestException);
      expect(clinicalRecordRepository.findOrCreateClinicalRecordByPatientId).not.toHaveBeenCalled();
    });

    it('crea ficha clínica, producto, orden y consulta nutricional, devolviendo el orderId', async () => {
      authIdentityService.getUserBySub.mockResolvedValue({ id: 'user-1' } as any);
      authIdentityService.isProfileComplete.mockReturnValue(true);
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

      const result = await service.createOrder(baseDto, cognitoUser);

      expect(result).toEqual({ orderId: 'order-1' });
      expect(authIdentityService.getUserBySub).toHaveBeenCalledWith(cognitoUser);
      expect(orderRepository.createOrder).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          productId: 'product-1',
          paymentStatus: 'pendiente',
          generationStatus: 'no_iniciado',
          planJson: null,
          pdfKey: null,
          thumbnailKey: null,
          attempts: 0,
        }),
      );
      expect(
        nutritionalConsultationRepository.createNutritionalConsultationWithDetails,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          consultation: expect.objectContaining({
            clinicalRecordId: 'clinical-1',
            patientId: 'user-1',
            orderId: 'order-1',
            consultationNumber: 1,
          }),
        }),
      );
    });
  });

  describe('getStatus / findById / findByIdWithUser / getConsultationForOrder', () => {
    const cognitoUser: CognitoUserClaims = { sub: 'test-sub' };

    it('getStatus devuelve el estado público, parseando planJson si existe, con la URL firmada de descarga del PDF y la de la miniatura', async () => {
      authIdentityService.getUserBySub.mockResolvedValue({ id: 'user-1' } as any);
      orderRepository.getOrderById.mockResolvedValue({
        userId: 'user-1',
        paymentStatus: 'pagado',
        generationStatus: 'completado',
        planJson: JSON.stringify({ prescription: { goal: 'volumen' } }),
        pdfKey: 'productos-personalizados/order-1.pdf',
        thumbnailKey: 'productos-personalizados/miniaturas/order-1.webp',
        creationDate: new Date('2026-01-01T00:00:00.000Z'),
      } as any);
      // firma distinto según la key para poder contrastar qué URL corresponde a qué objeto
      storageService.getSignedDownloadUrl.mockImplementation(
        async (key: string) => `https://signed-url.example/${key}`,
      );

      const status = await service.getStatus('order-1', cognitoUser);

      expect(status.paymentStatus).toBe('pagado');
      expect(status.generationStatus).toBe('completado');
      expect((status.planJson as any).prescription.goal).toBe('volumen');
      expect(status.pdfUrl).toBe('https://signed-url.example/productos-personalizados/order-1.pdf');
      expect(status.thumbnailUrl).toBe(
        'https://signed-url.example/productos-personalizados/miniaturas/order-1.webp',
      );
      // solo el PDF se firma como descarga, con nombre de archivo basado en la fecha de creación
      expect(storageService.getSignedDownloadUrl).toHaveBeenCalledWith(
        'productos-personalizados/order-1.pdf',
        undefined,
        { downloadFilename: 'plan-nutricional-2026-01-01.pdf' },
      );
      expect(storageService.getSignedDownloadUrl).toHaveBeenCalledWith(
        'productos-personalizados/miniaturas/order-1.webp',
      );
    });

    it('getStatus devuelve thumbnailUrl null (y firma solo el PDF) si el plan está listo pero no tiene miniatura', async () => {
      authIdentityService.getUserBySub.mockResolvedValue({ id: 'user-1' } as any);
      orderRepository.getOrderById.mockResolvedValue({
        userId: 'user-1',
        paymentStatus: 'pagado',
        generationStatus: 'completado',
        planJson: JSON.stringify({ prescription: { goal: 'volumen' } }),
        pdfKey: 'productos-personalizados/order-1.pdf',
        thumbnailKey: null,
        creationDate: new Date('2026-01-01T00:00:00.000Z'),
      } as any);
      storageService.getSignedDownloadUrl.mockResolvedValue('https://signed-url.example/plan.pdf');

      const status = await service.getStatus('order-1', cognitoUser);

      expect(status.pdfUrl).toBe('https://signed-url.example/plan.pdf');
      expect(status.thumbnailUrl).toBeNull();
      expect(storageService.getSignedDownloadUrl).toHaveBeenCalledTimes(1);
    });

    it('getStatus devuelve planJson, pdfUrl y thumbnailUrl null si aún no hay plan', async () => {
      authIdentityService.getUserBySub.mockResolvedValue({ id: 'user-1' } as any);
      orderRepository.getOrderById.mockResolvedValue({
        userId: 'user-1',
        paymentStatus: 'pendiente',
        generationStatus: 'no_iniciado',
        planJson: null,
        pdfKey: null,
        thumbnailKey: null,
        creationDate: new Date('2026-01-01T00:00:00.000Z'),
      } as any);

      const status = await service.getStatus('order-1', cognitoUser);
      expect(status.planJson).toBeNull();
      expect(status.pdfUrl).toBeNull();
      expect(status.thumbnailUrl).toBeNull();
      expect(storageService.getSignedDownloadUrl).not.toHaveBeenCalled();
    });

    it('getStatus lanza NotFoundException si la orden pertenece a otro usuario (BOLA)', async () => {
      authIdentityService.getUserBySub.mockResolvedValue({ id: 'user-1' } as any);
      orderRepository.getOrderById.mockResolvedValue({
        userId: 'otro-usuario',
        paymentStatus: 'pagado',
        generationStatus: 'completado',
        planJson: null,
        pdfKey: null,
      } as any);

      await expect(service.getStatus('order-1', cognitoUser)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('findById lanza NotFoundException si el repositorio devuelve null', async () => {
      orderRepository.getOrderById.mockResolvedValue(null);
      await expect(service.findById('missing')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('findByIdWithUser lanza NotFoundException si el repositorio devuelve null', async () => {
      orderRepository.getOrderWithUserById.mockResolvedValue(null);
      await expect(service.findByIdWithUser('missing')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('findByIdWithUser devuelve la orden si existe', async () => {
      orderRepository.getOrderWithUserById.mockResolvedValue({ id: 'order-1' } as any);
      await expect(service.findByIdWithUser('order-1')).resolves.toEqual({ id: 'order-1' });
    });

    it('getConsultationForOrder lanza NotFoundException si no hay consulta asociada', async () => {
      nutritionalConsultationRepository.getNutritionalConsultationWithDetailsByOrderId.mockResolvedValue(
        null,
      );
      await expect(service.getConsultationForOrder('order-1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('markAsPaid / tryStartGeneration', () => {
    it('markAsPaid delega el booleano del repositorio', async () => {
      orderRepository.markOrderAsPaidIfPending.mockResolvedValue(true);
      await expect(service.markAsPaid('order-1')).resolves.toBe(true);

      orderRepository.markOrderAsPaidIfPending.mockResolvedValue(false);
      await expect(service.markAsPaid('order-1')).resolves.toBe(false);
    });

    it('tryStartGeneration delega el booleano del repositorio', async () => {
      orderRepository.tryTransitionOrderToGenerating.mockResolvedValue(true);
      await expect(service.tryStartGeneration('order-1')).resolves.toBe(true);
    });
  });

  describe('completeGeneration / recordFailedAttempt', () => {
    it('completeGeneration serializa el plan a JSON, marca generationStatus completado y persiste pdfKey y thumbnailKey', async () => {
      const plan = { prescription: { goal: 'definicion' } } as unknown as NutritionPlanDto;
      await service.completeGeneration(
        'order-1',
        plan,
        'productos-personalizados/order-1.pdf',
        'productos-personalizados/miniaturas/order-1.webp',
      );

      expect(orderRepository.updateOrderById).toHaveBeenCalledWith('order-1', {
        generationStatus: 'completado',
        planJson: JSON.stringify(plan),
        pdfKey: 'productos-personalizados/order-1.pdf',
        thumbnailKey: 'productos-personalizados/miniaturas/order-1.webp',
      });
    });

    it('completeGeneration persiste thumbnailKey null si la miniatura no se pudo generar', async () => {
      const plan = { prescription: { goal: 'definicion' } } as unknown as NutritionPlanDto;
      await service.completeGeneration('order-1', plan, 'productos-personalizados/order-1.pdf', null);

      expect(orderRepository.updateOrderById).toHaveBeenCalledWith(
        'order-1',
        expect.objectContaining({ generationStatus: 'completado', thumbnailKey: null }),
      );
    });

    it('recordFailedAttempt delega en el repositorio', async () => {
      await service.recordFailedAttempt('order-1');
      expect(orderRepository.incrementOrderFailedAttempt).toHaveBeenCalledWith('order-1');
    });
  });

  describe('getOrdersForUser', () => {
    const cognitoUser: CognitoUserClaims = { sub: 'test-sub' };
    const creationDate = new Date('2026-01-01T00:00:00.000Z');

    beforeEach(() => {
      authIdentityService.getUserBySub.mockResolvedValue({ id: 'user-1' } as any);
      // firma distinto según la key para poder contrastar qué URL corresponde a qué objeto
      storageService.getSignedDownloadUrl.mockImplementation(
        async (key: string) => `https://signed-url.example/${key}`,
      );
    });

    it('devuelve las órdenes del usuario con la URL firmada de descarga del PDF (attachment) y la de la miniatura', async () => {
      orderRepository.getPaidOrdersWithPdfByUserId.mockResolvedValue([
        {
          id: 'order-1',
          creationDate,
          pdfKey: 'productos-personalizados/order-1.pdf',
          thumbnailKey: 'productos-personalizados/miniaturas/order-1.webp',
        } as any,
      ]);

      const summaries = await service.getOrdersForUser(cognitoUser);

      expect(orderRepository.getPaidOrdersWithPdfByUserId).toHaveBeenCalledWith('user-1');
      expect(summaries).toEqual([
        {
          orderId: 'order-1',
          creationDate,
          pdfUrl: 'https://signed-url.example/productos-personalizados/order-1.pdf',
          thumbnailUrl: 'https://signed-url.example/productos-personalizados/miniaturas/order-1.webp',
        },
      ]);
      // solo el PDF se firma como descarga, con nombre de archivo basado en la fecha de creación
      expect(storageService.getSignedDownloadUrl).toHaveBeenCalledWith(
        'productos-personalizados/order-1.pdf',
        undefined,
        { downloadFilename: 'plan-nutricional-2026-01-01.pdf' },
      );
      expect(storageService.getSignedDownloadUrl).toHaveBeenCalledWith(
        'productos-personalizados/miniaturas/order-1.webp',
      );
    });

    it('thumbnailUrl es null (y no se firma nada) si la orden no tiene miniatura', async () => {
      orderRepository.getPaidOrdersWithPdfByUserId.mockResolvedValue([
        { id: 'order-1', creationDate, pdfKey: 'productos-personalizados/order-1.pdf', thumbnailKey: null } as any,
      ]);

      const [summary] = await service.getOrdersForUser(cognitoUser);

      expect(summary.thumbnailUrl).toBeNull();
      expect(summary.pdfUrl).toBe('https://signed-url.example/productos-personalizados/order-1.pdf');
      expect(storageService.getSignedDownloadUrl).toHaveBeenCalledTimes(1);
    });
  });

  describe('cleanupOldOrders', () => {
    it('devuelve la cantidad anonimizada por el repositorio', async () => {
      orderRepository.anonymizeOldOrders.mockResolvedValue(3);
      await expect(service.cleanupOldOrders(45)).resolves.toBe(3);
      expect(orderRepository.anonymizeOldOrders).toHaveBeenCalledWith(expect.any(Date));
    });

    it('no falla si no hay órdenes que limpiar (count 0)', async () => {
      orderRepository.anonymizeOldOrders.mockResolvedValue(0);
      await expect(service.cleanupOldOrders(45)).resolves.toBe(0);
    });
  });
});
