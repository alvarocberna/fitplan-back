import { NutritionPlanDto } from '../../dtos/nutrition-plan.dto';

// order.plan_json es texto libre guardado al completar la generación. Si está corrupto (o es de una
// versión anterior que no es JSON) no debe romper una lectura: se trata como "sin plan".
export function parsePlanJson(raw: string | null | undefined): NutritionPlanDto | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as NutritionPlanDto) : null;
  } catch {
    return null;
  }
}
