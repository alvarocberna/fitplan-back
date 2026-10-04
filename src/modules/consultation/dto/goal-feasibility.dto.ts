import { IsNumber, IsOptional, IsPositive, Max, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { GoalsDtoImpl } from './consultation.dto';

export class GoalFeasibilityMeasurementsDtoImpl {
  @IsNumber()
  @IsPositive()
  @Max(500)
  weight!: number;

  @IsNumber()
  @IsPositive()
  @Max(300)
  height!: number;
}

// Body de POST /consultations/goal-feasibility: el objetivo recolectado en el chat de anamnesis y
// el peso/talla de la evaluación física. El sexo y la composición corporal salen del usuario (token).
export class GoalFeasibilityRequestDtoImpl {
  @ValidateNested()
  @Type(() => GoalsDtoImpl)
  @IsOptional()
  goals!: GoalsDtoImpl | null;

  @ValidateNested()
  @Type(() => GoalFeasibilityMeasurementsDtoImpl)
  measurements!: GoalFeasibilityMeasurementsDtoImpl;
}

export type ProjectionGoalDto = 'definicion' | 'mantencion' | 'volumen';

export class GoalFeasibilityResponseDtoImpl {
  feasible!: boolean;

  goal!: ProjectionGoalDto;

  // Mensaje para el paciente cuando el objetivo no es factible; null si lo es.
  message!: string | null;
}
