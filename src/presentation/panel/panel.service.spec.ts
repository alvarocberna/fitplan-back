import { Test, TestingModule } from '@nestjs/testing';
import { PanelService } from './panel.service';
import { AuthIdentityService } from '../auth/auth-identity.service';
import { NutritionalConsultationRepository } from '../../domain/repositories/clinical-domain/nutritional-consultation.repository';
import { calculateAge } from '../../domain';
import type { CognitoUserClaims } from '../auth/cognito-user.decorator';

describe('PanelService', () => {
  let service: PanelService;
  let authIdentityService: jest.Mocked<AuthIdentityService>;
  let nutritionalConsultationRepository: jest.Mocked<NutritionalConsultationRepository>;

  const cognitoUser: CognitoUserClaims = { sub: 'test-sub' };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PanelService,
        { provide: AuthIdentityService, useValue: { getUserBySub: jest.fn() } },
        {
          provide: NutritionalConsultationRepository,
          useValue: {
            getLatestNutritionalConsultationWithDetailsByPatientId: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(PanelService);
    authIdentityService = module.get(AuthIdentityService);
    nutritionalConsultationRepository = module.get(
      NutritionalConsultationRepository,
    );
  });

  describe('getSummary', () => {
    it('arma el resumen con nombre completo, edad, fecha de consulta, objetivo y plan cuando hay una consulta con goals y un plan activo con su nutritionalPlan principal', async () => {
      const dateOfBirth = new Date('1995-01-01');
      authIdentityService.getUserBySub.mockResolvedValue({
        id: 'user-1',
        firstName: 'Ana',
        middleName: 'María',
        paternalLastName: 'Pérez',
        maternalLastName: 'Soto',
        dateOfBirth,
      } as any);
      nutritionalConsultationRepository.getLatestNutritionalConsultationWithDetailsByPatientId.mockResolvedValue(
        {
          consultationDate: new Date('2026-03-15T12:00:00.000Z'),
          anamneses: [{ goals: [{ mainGoal: 'bajar de peso' }] }],
          plans: [
            {
              active: true,
              nutritionalPlans: [
                {
                  mainPlan: true,
                  dietRegimen: 'Régimen hipocalórico hiperproteico.',
                  calorieIntake: 2000,
                  proteinIntake: 150,
                  carbohydrateIntake: 200,
                  lipidIntake: 60,
                },
              ],
            },
          ],
        } as any,
      );

      const result = await service.getSummary(cognitoUser);

      expect(authIdentityService.getUserBySub).toHaveBeenCalledWith(cognitoUser);
      expect(
        nutritionalConsultationRepository.getLatestNutritionalConsultationWithDetailsByPatientId,
      ).toHaveBeenCalledWith('user-1');
      expect(result).toEqual({
        firstName: 'Ana',
        middleName: 'María',
        paternalLastName: 'Pérez',
        maternalLastName: 'Soto',
        age: calculateAge(dateOfBirth),
        lastConsultationDate: '2026-03-15T12:00:00.000Z',
        goal: 'bajar de peso',
        nutritionalPlan: {
          dietRegimen: 'Régimen hipocalórico hiperproteico.',
          calorieIntake: 2000,
          proteinIntake: 150,
          carbohydrateIntake: 200,
          lipidIntake: 60,
        },
      });
    });

    it('devuelve age null si el usuario no tiene dateOfBirth cargado, sin lanzar', async () => {
      authIdentityService.getUserBySub.mockResolvedValue({
        id: 'user-1',
        firstName: 'Ana',
        paternalLastName: 'Pérez',
        dateOfBirth: null,
      } as any);
      nutritionalConsultationRepository.getLatestNutritionalConsultationWithDetailsByPatientId.mockResolvedValue(
        {
          anamneses: [{ goals: [{ mainGoal: 'bajar de peso' }] }],
          plans: [{ active: true, nutritionalPlans: [] }],
        } as any,
      );

      const result = await service.getSummary(cognitoUser);

      expect(result.age).toBeNull();
    });

    it('devuelve goal y nutritionalPlan null (sin lanzar) si el paciente todavía no tiene ninguna consulta', async () => {
      authIdentityService.getUserBySub.mockResolvedValue({
        id: 'user-1',
        firstName: 'Ana',
        middleName: null,
        paternalLastName: 'Pérez',
        maternalLastName: null,
        dateOfBirth: null,
      } as any);
      nutritionalConsultationRepository.getLatestNutritionalConsultationWithDetailsByPatientId.mockResolvedValue(
        null,
      );

      const result = await service.getSummary(cognitoUser);

      expect(result).toEqual({
        firstName: 'Ana',
        middleName: null,
        paternalLastName: 'Pérez',
        maternalLastName: null,
        age: null,
        lastConsultationDate: null,
        goal: null,
        nutritionalPlan: null,
      });
    });

    it('devuelve goal y nutritionalPlan null si la consulta existe pero sin anamneses/plans asociados', async () => {
      authIdentityService.getUserBySub.mockResolvedValue({
        id: 'user-1',
        firstName: 'Ana',
        paternalLastName: 'Pérez',
        dateOfBirth: null,
      } as any);
      nutritionalConsultationRepository.getLatestNutritionalConsultationWithDetailsByPatientId.mockResolvedValue(
        { anamneses: [], plans: [] } as any,
      );

      const result = await service.getSummary(cognitoUser);

      expect(result.goal).toBeNull();
      expect(result.nutritionalPlan).toBeNull();
    });
  });
});
