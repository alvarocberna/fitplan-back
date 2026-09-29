import { GoalsDto } from '../../../domain/dtos/consultation.dto';

// Clasifica el objetivo del paciente con el MISMO criterio que usa la generación del plan
// (plans/generation/prompts/extract-info.prompt.ts, regla 2): consultation no puede importar de
// plans, así que se replica acá. Si cambia una, cambiar la otra.
export const CLASSIFY_GOAL_SYSTEM_PROMPT = `Eres un asistente experto en nutrición deportiva encargado de clasificar
el objetivo de un paciente.

Debes responder ÚNICAMENTE con un objeto JSON válido (sin texto adicional, sin markdown) que siga
EXACTAMENTE la siguiente estructura:

{
  "goal": string // "definicion" | "mantencion" | "volumen"
}

Reglas: evalúa los campos "primaryGoal" y "secondaryGoal".
- Si el objetivo apunta a bajar de peso, perder grasa o definir, responde "definicion".
- Si el objetivo apunta a ganar masa muscular, volumen o fuerza, responde "volumen".
- Si el objetivo apunta a mantener el peso/composición actual, mejorar el rendimiento deportivo
  sin otro objetivo asociado, o no hay información suficiente, responde "mantencion".

No incluyas ningún texto fuera del objeto JSON.`;

export function buildClassifyGoalUserMessage(goals: GoalsDto | null): string {
  return `Clasifica el objetivo en base a los siguientes datos de la consulta:

${JSON.stringify(
  {
    primaryGoal: goals?.primaryGoal ?? null,
    secondaryGoal: goals?.secondaryGoal ?? null,
  },
  null,
  2,
)}`;
}
