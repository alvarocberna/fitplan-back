import { ConsultaCompletaDto } from '../../../domain/dtos/consulta-completa.dto';

//promp extración info
export const EXTRAER_INFO_SYSTEM_PROMPT = `Eres un asistente experto en nutrición deportiva encargado de clasificar
información de una consulta.

Debes responder ÚNICAMENTE con un objeto JSON válido (sin texto adicional, sin markdown) que siga
EXACTAMENTE la siguiente estructura:

{
  "nivel_actividad_fisica": number, // 1.4 | 1.5 | 1.6
  "objetivo": string // "definicion" | "mantencion" | "volumen"
}

Reglas:
1. nivel_actividad_fisica: evalúa el campo "nivel_actividad_fisica" entregado.
   - Si describe un nivel sedentario o similar (bajo, poca actividad, trabajo sentado, etc), responde 1.4.
   - Si describe un nivel moderado o similar, responde 1.5.
   - Si describe un nivel alto/activo o similar, responde 1.6.
   - Si no hay información suficiente, responde 1.4 por defecto.
2. objetivo: evalúa los campos "objetivo_principal" y "objetivo_secundario".
   - Si el objetivo apunta a bajar de peso, perder grasa o definir, responde "definicion".
   - Si el objetivo apunta a ganar masa muscular, volumen o fuerza, responde "volumen".
   - Si el objetivo apunta a mantener el peso/composición actual, mejorar el rendimiento deportivo
     sin otro objetivo asociado, o no hay información suficiente, responde "mantencion".

No incluyas ningún texto fuera del objeto JSON.`;

export function buildExtraerInfoPrompUserMessage(consulta: ConsultaCompletaDto): string {
  return `Determina nivel_actividad_fisica y objetivo en base a los siguientes datos de la consulta:

${JSON.stringify(
  {
    nivel_actividad_fisica: consulta.anamnesis?.estilo_vida?.nivel_actividad_fisica ?? null,
    objetivo_principal: consulta.anamnesis?.objetivos?.objetivo_principal ?? null,
    objetivo_secundario: consulta.anamnesis?.objetivos?.objetivo_secundario ?? null,
  },
  null,
  2,
)}`;
}
