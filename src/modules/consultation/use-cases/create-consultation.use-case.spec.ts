import { BadRequestException } from '@nestjs/common';
import { CreateConsultationUseCase } from './create-consultation.use-case';
import { CurrentUserResolver } from '../../identity/current-user.resolver';
import { CreateOrderUseCase } from '../../billing/use-cases/create-order.use-case';
import { ClinicalRecordRepository } from '../../../domain/repositories/clinical-domain/clinical-record.repository';
import { NutritionalConsultationRepository } from '../../../domain/repositories/clinical-domain/nutritional-consultation.repository';
import { ProductRepository } from '../../../domain/repositories/commercial-domain/product.repository';
import { CompleteConsultationDtoImpl } from '../dto/consultation.dto';
import type { CognitoUserClaims } from '../../../common/auth/cognito-user.decorator';

describe('CreateConsultationUseCase', () => {
  let useCase: CreateConsultationUseCase;
  let currentUser: { resolve: jest.Mock; isProfileComplete: jest.Mock };
  let clinicalRecordRepository: { findOrCreateClinicalRecordByPatientId: jest.Mock };
  let nutritionalConsultationRepository: {
    countNutritionalConsultationsByClinicalRecordId: jest.Mock;
    createNutritionalConsultationWithDetails: jest.Mock;
  };
  let productRepository: { findOrCreateActiveGeneratedProduct: jest.Mock };
  let createOrder: { execute: jest.Mock };

  const claims: CognitoUserClaims = { sub: 'test-sub' };
  const product = { id: 'product-1', price: 10000, currency: 'CLP' };

  const baseDto = {
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
      dateOfBirth: new Date('1995-01-01'),
    },
    anamnesis: null,
    measurements: null,
  } as unknown as CompleteConsultationDtoImpl;

  beforeEach(() => {
    currentUser = {
      resolve: jest.fn().mockResolvedValue({ id: 'user-1' }),
      isProfileComplete: jest.fn().mockReturnValue(true),
    };
    clinicalRecordRepository = {
      findOrCreateClinicalRecordByPatientId: jest.fn().mockResolvedValue({ id: 'clinical-1' }),
    };
    nutritionalConsultationRepository = {
      countNutritionalConsultationsByClinicalRecordId: jest.fn().mockResolvedValue(0),
      createNutritionalConsultationWithDetails: jest.fn().mockResolvedValue({}),
    };
    productRepository = {
      findOrCreateActiveGeneratedProduct: jest.fn().mockResolvedValue(product),
    };
    createOrder = { execute: jest.fn().mockResolvedValue({ id: 'order-1' }) };

    useCase = new CreateConsultationUseCase(
      currentUser as unknown as CurrentUserResolver,
      clinicalRecordRepository as unknown as ClinicalRecordRepository,
      nutritionalConsultationRepository as unknown as NutritionalConsultationRepository,
      productRepository as unknown as ProductRepository,
      createOrder as unknown as CreateOrderUseCase,
    );
  });

  it('lanza BadRequestException si falta personalInfo', async () => {
    const dto = { ...baseDto, personalInfo: null } as unknown as CompleteConsultationDtoImpl;

    await expect(useCase.execute({ claims, consultation: dto })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(currentUser.resolve).not.toHaveBeenCalled();
  });

  it('lanza BadRequestException si el perfil (User) está incompleto', async () => {
    currentUser.isProfileComplete.mockReturnValue(false);

    await expect(useCase.execute({ claims, consultation: baseDto })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(clinicalRecordRepository.findOrCreateClinicalRecordByPatientId).not.toHaveBeenCalled();
    expect(createOrder.execute).not.toHaveBeenCalled();
  });

  it('crea ficha clínica, orden (vía billing) y consulta nutricional enlazada a la orden, devolviendo el orderId', async () => {
    const result = await useCase.execute({ claims, consultation: baseDto });

    expect(result).toEqual({ orderId: 'order-1' });
    expect(currentUser.resolve).toHaveBeenCalledWith(claims);
    expect(createOrder.execute).toHaveBeenCalledWith({ userId: 'user-1', product });
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
    // athlete vive en User (se captura en el perfil), ya no en la consulta.
    const [details] =
      nutritionalConsultationRepository.createNutritionalConsultationWithDetails.mock.calls[0];
    expect(details.consultation).not.toHaveProperty('athlete');
  });

  it('numera la consulta según las que ya tiene el historial', async () => {
    nutritionalConsultationRepository.countNutritionalConsultationsByClinicalRecordId.mockResolvedValue(2);

    await useCase.execute({ claims, consultation: baseDto });

    const [details] =
      nutritionalConsultationRepository.createNutritionalConsultationWithDetails.mock.calls[0];
    expect(details.consultation.consultationNumber).toBe(3);
  });

  it('fecha la medición con la misma consultationDate de la consulta', async () => {
    const dto = {
      ...baseDto,
      measurements: { weight: 70, height: 175, somatotype: null },
    } as unknown as CompleteConsultationDtoImpl;

    await useCase.execute({ claims, consultation: dto });

    const [details] =
      nutritionalConsultationRepository.createNutritionalConsultationWithDetails.mock.calls[0];
    expect(details.measurements!.measuredAt).toBeInstanceOf(Date);
    expect(details.measurements!.measuredAt).toBe(details.consultation.consultationDate);
  });
});
