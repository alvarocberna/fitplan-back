import { UNTRUSTED_INPUT_RULES } from '../../../../domain/services/llm/prompt-guard';
import { CompleteConsultationDto } from '../../../../domain/dtos/consultation.dto';

//prompt extración info
export const EXTRACT_INFO_SYSTEM_PROMPT = `Eres un asistente experto en nutrición deportiva encargado de clasificar
información de una consulta.

Debes responder ÚNICAMENTE con un objeto JSON válido (sin texto adicional, sin markdown) que siga
EXACTAMENTE la siguiente estructura:

{
  "physicalActivityLevel": number, // 1.4 | 1.5 | 1.6
  "goal": string // "definicion" | "mantencion" | "volumen"
}

Reglas:
1. physicalActivityLevel: evalúa el campo "physicalActivityLevel" entregado.
   - Si describe un nivel sedentario o similar (bajo, poca actividad, trabajo sentado, etc), responde 1.4.
   - Si describe un nivel moderado o similar, responde 1.5.
   - Si describe un nivel alto/activo o similar, responde 1.6.
   - Si no hay información suficiente, responde 1.4 por defecto.
2. goal: evalúa los campos "primaryGoal" y "secondaryGoal".
   - Si el objetivo apunta a bajar de peso, perder grasa o definir, responde "definicion".
   - Si el objetivo apunta a ganar masa muscular, volumen o fuerza, responde "volumen".
   - Si el objetivo apunta a mantener el peso/composición actual, mejorar el rendimiento deportivo
     sin otro objetivo asociado, o no hay información suficiente, responde "mantencion".

No incluyas ningún texto fuera del objeto JSON.${UNTRUSTED_INPUT_RULES}`;

export function buildExtractInfoPromptUserMessage(
  consultation: CompleteConsultationDto,
): string {
  return `Determina physicalActivityLevel y goal en base a los siguientes datos de la consulta:

${JSON.stringify(
  {
    physicalActivityLevel:
      consultation.anamnesis?.lifestyle?.physicalActivityLevel ?? null,
    primaryGoal: consultation.anamnesis?.goals?.primaryGoal ?? null,
    secondaryGoal: consultation.anamnesis?.goals?.secondaryGoal ?? null,
  },
  null,
  2,
)}`;
}
