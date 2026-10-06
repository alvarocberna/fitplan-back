import { Controller, Get } from '@nestjs/common';
import { PersonalizedProductDto } from '../../domain';
import { GetPersonalizedPlanUseCase } from './use-cases/get-personalized-plan.use-case';

// Ficha del plan personalizado (Product de tipo GENERATED). Pública a propósito (sin
// CognitoAuthGuard), igual que el catálogo estándar: el precio se muestra antes de iniciar sesión.
@Controller('plans/personalized')
export class PersonalizedPlansController {
  constructor(private readonly getPersonalizedPlan: GetPersonalizedPlanUseCase) {}

  @Get()
  get(): Promise<PersonalizedProductDto> {
    return this.getPersonalizedPlan.execute();
  }
}
