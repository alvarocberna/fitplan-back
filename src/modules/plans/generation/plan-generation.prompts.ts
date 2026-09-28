//domain
import { CompleteConsultationDto } from '../../../domain/dtos/consultation.dto';
import { Requirements } from '../../../domain/services/formulas/requirements/requirements.service';
import { CalculatedMealTime, CalculatedIntake } from '../../../domain/services/alimentos/portion-adequacy.service';
import { SupplementsPrescription } from '../../../domain/services/formulas/requirements/supplements.service';
//prompts
import { buildPrescriptionPrompt } from './prompts/prescription.prompt';
import { buildMealTimesPrompt } from './prompts/meal-times.prompt';
import { buildSupplementsPrompt } from './prompts/supplements.prompt';
import { buildSportsRecommendationsPrompt } from './prompts/sports-recommendations.prompt';

//barrel
export { NUTRITIONIST_SYSTEM_PROMPT } from './prompts/nutritionist-system.prompt';
export { EXTRACT_INFO_SYSTEM_PROMPT, buildExtractInfoPromptUserMessage } from './prompts/extract-info.prompt';

/*
Este archivo solo orquesta: arma buildUserPrompt() concatenando las secciones de arriba,
y reexporta los prompts que se usan fuera de este módulo.
*/

export function buildUserPrompt(
  consultation: CompleteConsultationDto,
  requirements: Requirements,
  goal: string,
  supplementsPrescription: SupplementsPrescription,
  calculatedMealTimes: CalculatedMealTime[],
  supplementIntakeNote: string | null,
  wheyIntake: CalculatedIntake,
): string {
  return `A continuación se entrega la información de la consulta de un paciente, junto con datos ya
calculados por el sistema. Completa el plan nutricional siguiendo estas instrucciones para cada sección:

${buildPrescriptionPrompt(goal)}

${buildMealTimesPrompt(calculatedMealTimes)}

${buildSupplementsPrompt(supplementsPrescription, supplementIntakeNote, wheyIntake)}

${buildSportsRecommendationsPrompt(consultation.anamnesis?.lifestyle?.sportSession ?? null)}

### Requerimientos nutricionales (contexto; ya fueron usados para calcular las porciones de "Tiempos de comida")
${JSON.stringify(requirements, null, 2)}

### Datos de la consulta (anamnesis y evaluación física)
${JSON.stringify({ anamnesis: consultation.anamnesis, physicalAssessment: consultation.measurements }, null, 2)}`;
}
