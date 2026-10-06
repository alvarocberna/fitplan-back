import { NutritionPlanDto } from '../dtos/nutrition-plan.dto';

// Puerto hacia el envío de correos (hoy un stub que solo registra en el log, ver
// infrastructure/email).
export abstract class EmailSender {
  // `attachment` es el PDF ya generado: el envío no lo vuelve a renderizar.
  abstract sendPlanByEmail(
    email: string,
    plan: NutritionPlanDto,
    attachment: Buffer,
  ): Promise<void>;
}
