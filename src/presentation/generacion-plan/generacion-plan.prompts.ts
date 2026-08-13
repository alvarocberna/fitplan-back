//domain
import { ConsultaCompletaDto } from '../../domain/dtos/consulta-completa.dto';
import { Requerimientos } from '../../domain/services/formulas/requerimientos.service';
import { TiempoComidaCalculado, AporteCalculado } from '../../domain/services/alimentos/adecuacion-porciones.service';
import { SupplementsPrescription } from '../../domain/services/formulas/suplementos.service';
//prompts 
import { buildPrescripcionPrompt } from './prompts/prescripcion.prompt';
import { buildTiemposDeComidaPrompt } from './prompts/tiempos-comida.prompt';
import { buildSuplementosPrompt } from './prompts/suplementos.prompt';
import { buildRecomendacionesDeportivasPrompt } from './prompts/recomendaciones-deportivas.prompt';

//barrel
export { NUTRICIONISTA_SYSTEM_PROMPT } from './prompts/nutricionista-system.prompt';
export { EXTRAER_INFO_SYSTEM_PROMPT, buildExtraerInfoPrompUserMessage } from './prompts/extraer-info.prompt';

/*
Este archivo solo orquesta: arma buildUserPrompt() concatenando las secciones de arriba, 
y reexporta los prompts que se usan fuera de este módulo.
*/

export function buildUserPrompt(
  consulta: ConsultaCompletaDto,
  requerimientos: Requerimientos,
  objetivo: string,
  supplementsPrescription: SupplementsPrescription,
  tiemposCalculados: TiempoComidaCalculado[],
  adecuacionSuplementos: string | null,
  aporteSuplementoWhey: AporteCalculado,
): string {
  return `A continuación se entrega la información de la consulta de un paciente, junto con datos ya
calculados por el sistema. Completa el plan nutricional siguiendo estas instrucciones para cada sección:

${buildPrescripcionPrompt(objetivo)}

${buildTiemposDeComidaPrompt(tiemposCalculados)}

${buildSuplementosPrompt(supplementsPrescription, adecuacionSuplementos, aporteSuplementoWhey)}

${buildRecomendacionesDeportivasPrompt(consulta.anamnesis?.estilo_vida?.sesion_deportiva ?? null)}

### Requerimientos nutricionales (contexto; ya fueron usados para calcular las porciones de "Tiempos de comida")
${JSON.stringify(requerimientos, null, 2)}

### Datos de la consulta (anamnesis y evaluación física)
${JSON.stringify({ anamnesis: consulta.anamnesis, evaluacionFisica: consulta.mediciones }, null, 2)}`;
}
