import {
  EvaluateGoalFeasibilityUseCase,
  WEIGHT_LOSS_NOT_FEASIBLE_MESSAGE,
} from './evaluate-goal-feasibility.use-case';
import { CurrentUserResolver } from '../../identity/current-user.resolver';
import { MeasurementsRepository } from '../../../domain/repositories/clinical-domain/measurements.repository';
import { LlmProvider } from '../../../domain/ports';
import type { CognitoUserClaims } from '../../../common/auth/cognito-user.decorator';

describe('EvaluateGoalFeasibilityUseCase', () => {
  let useCase: EvaluateGoalFeasibilityUseCase;
  let currentUser: { resolve: jest.Mock };
  let measurementsRepository: { listMeasurementsByPatientId: jest.Mock };
  let llm: { chatJson: jest.Mock };

  const claims: CognitoUserClaims = { sub: 'test-sub' };
  const loseWeight = { primaryGoal: 'quiero bajar de peso', secondaryGoal: null };

  beforeEach(() => {
    currentUser = { resolve: jest.fn().mockResolvedValue({ id: 'user-1', gender: 'F' }) };
    measurementsRepository = { listMeasurementsByPatientId: jest.fn().mockResolvedValue([]) };
    llm = { chatJson: jest.fn().mockResolvedValue({ goal: 'definicion' }) };
    useCase = new EvaluateGoalFeasibilityUseCase(
      currentUser as unknown as CurrentUserResolver,
      measurementsRepository as unknown as MeasurementsRepository,
      llm as unknown as LlmProvider,
    );
  });

  it('bajar de peso con IMC <= 20 no es factible y devuelve el mensaje para el paciente', async () => {
    // 55 kg / 170 cm = IMC 19
    const result = await useCase.execute({
      claims,
      goals: loseWeight,
      measurements: { weight: 55, height: 170 },
    });

    expect(result).toEqual({
      feasible: false,
      goal: 'definicion',
      message: WEIGHT_LOSS_NOT_FEASIBLE_MESSAGE,
    });
    expect(currentUser.resolve).toHaveBeenCalledWith(claims);
    expect(measurementsRepository.listMeasurementsByPatientId).toHaveBeenCalledWith('user-1');
  });

  it('bajar de peso con IMC saludable es factible', async () => {
    await expect(
      useCase.execute({ claims, goals: loseWeight, measurements: { weight: 80, height: 172 } }),
    ).resolves.toEqual({ feasible: true, goal: 'definicion', message: null });
  });

  it('considera el %GC de la última medición que lo tenga (mujer bajo 20% tras 1 mes)', async () => {
    measurementsRepository.listMeasurementsByPatientId.mockResolvedValue([
      { measurementResults: [{ bfPercentage: 20.5, mmKg: null }] },
    ]);

    const result = await useCase.execute({
      claims,
      goals: loseWeight,
      measurements: { weight: 70, height: 165 },
    });

    expect(result.feasible).toBe(false);
  });

  it('volumen es factible sin leer usuario ni mediciones', async () => {
    llm.chatJson.mockResolvedValue({ goal: 'volumen' });

    await expect(
      useCase.execute({
        claims,
        goals: { primaryGoal: 'ganar masa muscular', secondaryGoal: null },
        measurements: { weight: 50, height: 175 },
      }),
    ).resolves.toEqual({ feasible: true, goal: 'volumen', message: null });
    expect(currentUser.resolve).not.toHaveBeenCalled();
  });

  it('sin objetivo declarado es "mantencion" sin llamar al LLM', async () => {
    await expect(
      useCase.execute({ claims, goals: null, measurements: { weight: 50, height: 175 } }),
    ).resolves.toEqual({ feasible: true, goal: 'mantencion', message: null });
    expect(llm.chatJson).not.toHaveBeenCalled();
  });

  it('una clasificación fuera de los valores esperados se trata como "mantencion"', async () => {
    llm.chatJson.mockResolvedValue({ goal: 'otra cosa' });

    await expect(
      useCase.execute({ claims, goals: loseWeight, measurements: { weight: 50, height: 175 } }),
    ).resolves.toEqual({ feasible: true, goal: 'mantencion', message: null });
  });

  it('sin peso o talla no puede evaluar y lo deja pasar', async () => {
    await expect(
      useCase.execute({ claims, goals: loseWeight, measurements: null }),
    ).resolves.toEqual({ feasible: true, goal: 'definicion', message: null });
  });
});
