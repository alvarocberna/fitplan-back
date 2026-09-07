import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { UserRepository } from '../../domain/repositories/identity-auth/user.repository';
import { ClinicalRecordRepository } from '../../domain/repositories/clinical-domain/clinical-record.repository';
import { NutritionalConsultationRepository } from '../../domain/repositories/clinical-domain/nutritional-consultation.repository';
import { ProductRepository } from '../../domain/repositories/commercial-domain/product.repository';
import { OrderRepository } from '../../domain/repositories/commercial-domain/order.repository';
import { CompleteConsultationDtoImpl } from '../consultation/dto/consultation.dto';
import { NutritionPlanDto } from '../../domain';

describe('OrdersService', () => {
  let service: OrdersService;
  let userRepository: jest.Mocked<UserRepository>;
  let clinicalRecordRepository: jest.Mocked<ClinicalRecordRepository>;
  let nutritionalConsultationRepository: jest.Mocked<NutritionalConsultationRepository>;
  let productRepository: jest.Mocked<ProductRepository>;
  let orderRepository: jest.Mocked<OrderRepository>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        {
          provide: UserRepository,
          useValue: { findOrCreateUserByEmail: jest.fn() },
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
            markOrderAsPaidIfPending: jest.fn(),
            tryTransitionOrderToGenerating: jest.fn(),
            updateOrderById: jest.fn(),
            incrementOrderFailedAttempt: jest.fn(),
            anonymizeOldOrders: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(OrdersService);
    userRepository = module.get(UserRepository);
    clinicalRecordRepository = module.get(ClinicalRecordRepository);
    nutritionalConsultationRepository = module.get(NutritionalConsultationRepository);
    productRepository = module.get(ProductRepository);
    orderRepository = module.get(OrderRepository);
  });

  describe('createOrder', () => {
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

    it('lanza BadRequestException si falta el email de contacto', async () => {
      const dto = { ...baseDto, personalInfo: { ...baseDto.personalInfo, email: null } } as CompleteConsultationDtoImpl;
      await expect(service.createOrder(dto)).rejects.toBeInstanceOf(BadRequestException);
      expect(userRepository.findOrCreateUserByEmail).not.toHaveBeenCalled();
    });

    it('crea usuario, ficha clínica, producto, orden y consulta nutricional, devolviendo el orderId', async () => {
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

      const result = await service.createOrder(baseDto);

      expect(result).toEqual({ orderId: 'order-1' });
      expect(userRepository.findOrCreateUserByEmail).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'ana@example.com' }),
      );
      expect(orderRepository.createOrder).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          productId: 'product-1',
          paymentStatus: 'pendiente',
          generationStatus: 'no_iniciado',
          planJson: null,
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
    it('getStatus devuelve el estado público, parseando planJson si existe', async () => {
      orderRepository.getOrderById.mockResolvedValue({
        paymentStatus: 'pagado',
        generationStatus: 'completado',
        planJson: JSON.stringify({ prescription: { goal: 'volumen' } }),
      } as any);

      const status = await service.getStatus('order-1');

      expect(status.paymentStatus).toBe('pagado');
      expect(status.generationStatus).toBe('completado');
      expect((status.planJson as any).prescription.goal).toBe('volumen');
    });

    it('getStatus devuelve planJson null si aún no hay plan', async () => {
      orderRepository.getOrderById.mockResolvedValue({
        paymentStatus: 'pendiente',
        generationStatus: 'no_iniciado',
        planJson: null,
      } as any);

      const status = await service.getStatus('order-1');
      expect(status.planJson).toBeNull();
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
    it('completeGeneration serializa el plan a JSON y marca generationStatus completado', async () => {
      const plan = { prescription: { goal: 'definicion' } } as unknown as NutritionPlanDto;
      await service.completeGeneration('order-1', plan);

      expect(orderRepository.updateOrderById).toHaveBeenCalledWith('order-1', {
        generationStatus: 'completado',
        planJson: JSON.stringify(plan),
      });
    });

    it('recordFailedAttempt delega en el repositorio', async () => {
      await service.recordFailedAttempt('order-1');
      expect(orderRepository.incrementOrderFailedAttempt).toHaveBeenCalledWith('order-1');
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
