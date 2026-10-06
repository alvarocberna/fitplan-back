import { UNTRUSTED_INPUT_RULES } from '../../../../domain/services/llm/prompt-guard';
import { CalculatedMealTime } from '../../../../domain/services/alimentos/portion-adequacy.service';
import { PlanIssue } from '../plan-validation';
import { GeneratedMealTime } from '../schemas/generated-plan.schema';
import { buildMealTimesInfo, MEAL_TIMES_INSTRUCTIONS } from './meal-times.prompt';

// Reintento dirigido: cuando la validación en código rechaza algunos tiempos de comida del plan que
// redactó el modelo, en vez de pedir el plan completo de nuevo se le pide corregir SOLO esos tiempos,
// mostrándole lo que respondió y la lista exacta de errores. El resto del plan se conserva.

export const REPAIR_SYSTEM_PROMPT = `Eres un nutricionista experto en nutrición deportiva. Redactaste un plan
nutricional y el sistema encontró errores en algunos tiempos de comida al verificar automáticamente tus
"examples" y "equivalences" contra las porciones ya calculadas.

Tu tarea es CORREGIR únicamente los tiempos de comida que se te entregan, para que cumplan EXACTAMENTE
las porciones indicadas. Devuelve cada tiempo de comida corregido completo (hour, examples, equivalences,
comments) junto con su "index", sin omitir ninguno de los entregados y sin agregar otros.

- Corrige lo que señala la lista de errores y revisa que el resto del tiempo de comida siga cumpliendo
  las reglas: puedes conservar lo que ya estaba bien.
- Las porciones de cada grupo ("portions") NO se cambian: lo que se ajusta es el alimento elegido y su
  gramaje, para que el gramaje reportado ÷ gramaje de 1 porción del alimento dé exactamente "portions".
- "food" debe ser el nombre EXACTO de un alimento listado en "exampleFoods" del grupo que indica "field".${UNTRUSTED_INPUT_RULES}`;

export function buildRepairUserPrompt(
  calculatedMealTimes: CalculatedMealTime[],
  generatedMealTimes: GeneratedMealTime[],
  issues: PlanIssue[],
  mealTimeIndexes: number[],
): string {
  const indexes = new Set(mealTimeIndexes);
  // mismos datos calculados que recibió al generar el plan, solo para los tiempos a corregir
  const info = buildMealTimesInfo(calculatedMealTimes).filter((mealTime) => indexes.has(mealTime.index));
  const previous = mealTimeIndexes.map((index) => ({ index, ...generatedMealTimes[index] }));
  const errors = mealTimeIndexes.map((index) => ({
    index,
    errors: issues
      .filter((issue) => issue.mealTimeIndex === index)
      .map((issue) => `[${issue.scope}] ${issue.message}`),
  }));

  return `Corrige los siguientes tiempos de comida (índices ${mealTimeIndexes.join(', ')}).

### Errores encontrados (por tiempo de comida)
${JSON.stringify(errors, null, 2)}

### Lo que respondiste para esos tiempos de comida
${JSON.stringify(previous, null, 2)}

### Reglas que debe cumplir cada tiempo de comida
${MEAL_TIMES_INSTRUCTIONS}
${JSON.stringify(info, null, 2)}`;
}
