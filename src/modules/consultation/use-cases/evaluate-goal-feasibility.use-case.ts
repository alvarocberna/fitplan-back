import { Injectable } from '@nestjs/common';
import { GoalsDto } from '../../../domain/dtos/consultation.dto';
import { LlmProvider } from '../../../domain/ports';
import { MeasurementsRepository } from '../../../domain/repositories/clinical-domain/measurements.repository';
import {
  evaluateGoalFeasibility,
  findLatestBodyComposition,
} from '../../../domain/services/projection/projection.service';
import { CognitoUserClaims } from '../../../common/auth/cognito-user.decorator';
import { CurrentUserResolver } from '../../identity/current-user.resolver';
import {
  GoalFeasibilityResponseDtoImpl,
  ProjectionGoalDto,
} from '../dto/goal-feasibility.dto';
import {
  buildClassifyGoalUserMessage,
  CLASSIFY_GOAL_SYSTEM_PROMPT,
} from '../prompts/classify-goal.prompt';
import { ClassifiedGoal, CLASSIFY_GOAL_SCHEMA } from '../prompts/classify-goal.schema';

// Mismo modelo económico que el chat de anamnesis (ver chat-anamnesis.use-case.ts).
// Se lee en cada uso (función): al importar este archivo el .env todavía no está cargado.
const consultationModel = () => process.env.OPENAI_MODEL_CONSULTA ?? 'gpt-4o-mini';

const GOALS: ProjectionGoalDto[] = ['definicion', 'mantencion', 'volumen'];

export const WEIGHT_LOSS_NOT_FEASIBLE_MESSAGE =
  'Lo siento, he detectado que tu peso corporal ya está bajo, y trabajar una pérdida de peso ' +
  'podría no ser adecuado. Si quieres, podemos trabajar otros objetivos.';

// CU-CON-03. Al terminar la evaluación física (y otra vez al crear la consulta, CU-CON-02) evalúa
// si el objetivo es alcanzable sin comprometer el estado nutricional: clasifica el objetivo con el
// LLM y aplica las reglas de proyección (doc/nutrition-plan/proyeccion.md). Bajar de peso no es
// factible si ni 1 mes de pérdida deja al paciente con IMC >= 20 y %GC sobre el mínimo por sexo.
@Injectable()
export class EvaluateGoalFeasibilityUseCase {
  constructor(
    private readonly currentUser: CurrentUserResolver,
    private readonly measurementsRepository: MeasurementsRepository,
    private readonly llm: LlmProvider,
  ) {}

  async execute(input: {
    claims: CognitoUserClaims;
    goals: GoalsDto | null;
    measurements: { weight: number | null; height: number | null } | null;
  }): Promise<GoalFeasibilityResponseDtoImpl> {
    const weight = input.measurements?.weight;
    const height = input.measurements?.height;
    const goal = await this.classifyGoal(input.goals);
    if (goal !== 'definicion' || weight == null || height == null) {
      return { feasible: true, goal, message: null };
    }

    const user = await this.currentUser.resolve(input.claims);
    const { bfPercentage } = findLatestBodyComposition(
      await this.measurementsRepository.listMeasurementsByPatientId(user.id),
    );
    const { feasible } = evaluateGoalFeasibility({
      goal,
      weight,
      height,
      gender: user.gender,
      bfPercentage,
    });
    return {
      feasible,
      goal,
      message: feasible ? null : WEIGHT_LOSS_NOT_FEASIBLE_MESSAGE,
    };
  }

  // Sin objetivo declarado no hace falta llamar al LLM: es "mantencion". Una respuesta fuera de los
  // valores esperados también se trata como "mantencion" (mismo default que el prompt).
  private async classifyGoal(goals: GoalsDto | null): Promise<ProjectionGoalDto> {
    if (!goals?.primaryGoal && !goals?.secondaryGoal?.length) return 'mantencion';
    const { goal } = await this.llm.chatJson<ClassifiedGoal>(
      CLASSIFY_GOAL_SYSTEM_PROMPT,
      [{ role: 'user', content: buildClassifyGoalUserMessage(goals) }],
      consultationModel(),
      undefined,
      // structured output: el modelo solo puede responder uno de los tres objetivos
      { schema: CLASSIFY_GOAL_SCHEMA },
    );
    return GOALS.includes(goal as ProjectionGoalDto)
      ? (goal as ProjectionGoalDto)
      : 'mantencion';
  }
}
