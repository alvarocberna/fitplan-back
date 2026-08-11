//DOMAIN
import { ConsultaCompletaDto, EstiloVidaSaludableDto } from '../../domain/dtos/consulta-completa.dto';
import { Requerimientos } from '../../domain/services/formulas/requerimientos.service';
import { PORCIONES_GRUPOS_ALIMENTOS, CAMPO_ALIMENTOS_A_GRUPO } from '../../domain/services/alimentos/porciones-alimentos';
import { TiempoComidaCalculado, AporteCalculado } from '../../domain/services/alimentos/adecuacion-porciones.service';
import { SupplementsPrescription } from '../../domain/services/formulas/suplementos.service';
import { SESIONES_DEPORTIVAS, recomendacionSesionDeportiva } from '../../domain/services/formulas/sesion-deportiva.service';

/*
INDICE
Promp global - NUTRICIONISTA_SYSTEM_PROMPT
Promp prescripcion (paso 2 doc) - buildPrescripcionPrompt
Promp resto del campo tiempos_de_comida: hora, ejemplos, comentarios (paso 3 y 4 doc) - buildTiemposDeComidaPrompt
  (el campo "alimentos" y "aporte" ya NO se le piden a la IA: se calculan por código en
  adecuacion-porciones.service.ts, ver doc/plan-nutricional/adecuacion-porciones.md)
Promp con instrucciones de prescripción de suplementos (paso 5 doc)
Promp con instrucciones de prescripción de indicaciones deportivas (paso 6 doc)
Promp para extraer info - EXTRAER_INFO_SYSTEM_PROMPT
*/

export const NUTRICIONISTA_SYSTEM_PROMPT = `Eres un nutricionista experto en nutrición deportiva.
Tu tarea es completar, en base a la información de una consulta (anamnesis y evaluación física de un
paciente) y a información ya calculada por el sistema (que se te entrega más abajo), las partes del plan
nutricional que requieren criterio clínico o redacción.

Debes responder ÚNICAMENTE con un objeto JSON válido (sin texto adicional, sin markdown) que siga
EXACTAMENTE la siguiente estructura:

{
  "prescripcion": {
    "regimen": string,
    "objetivo": string
  },
  "tiempos_de_comida": [
    {
        "hora": string | null, // ej "10am"
        "ejemplos": string[], // 3 ejemplos de combinaciones de alimentos específicos (con su porción)
        "comentarios": string[]
    }
  ],
  "suplementos": [
    {
      supplement: string,
      requirement: number,
      dosageIndication: string,
      intakeIndication: string,
      effects: string[],
      considerations: string[],
      aporte: { calorias: number, proteina: number, carbohidrato: number, lipido: number },
    }
  ],
  "recomendaciones_deportivas": [
    {
      "sesion": string,
      "estrategia": string,
      "pre_actividad": string,
      "durante_actividad": string,
      "post_actividad": string
    }
  ]
}

IMPORTANTE: el arreglo "tiempos_de_comida" que devuelvas debe tener EXACTAMENTE la misma cantidad de
objetos, EN EL MISMO ORDEN, que la lista entregada en la sección "Tiempos de comida ya calculados" del
mensaje del usuario. No agregues, quites, fusiones ni reordenes tiempos de comida: cada objeto que
devuelvas en la posición i corresponde al tiempo de comida en la posición i de esa lista.

No incluyas los campos "informacion_personal", "calorias", "proteina", "carbohidrato", "lipido",
"alimentos" ni "aporte": esos campos se completan aparte, fuera de tu respuesta.
No incluyas ningún texto fuera del objeto JSON.`;


//PASO 2 DOC
function buildPrescripcionPrompt(objetivo: string): string {
  return `
### Prescripción

Completa "regimen" y "objetivo" siguiendo EXACTAMENTE estas reglas (son reglas fijas, no las
reinterpretes con tu propio criterio):

**Campo "objetivo"**: una descripción breve, en lenguaje natural, del objetivo del paciente, construida
en base a los campos "objetivos.objetivo_principal" y "objetivos.objetivo_secundario" de la sección
"Datos de la consulta". Ejemplos de formato esperado (no copies el contenido, solo el estilo):
"Disminuir porcentaje de grasa corporal y mantener masa muscular", "Aumentar masa muscular",
"Mejorar rendimiento deportivo", "Mejorar rendimiento deportivo y ganar masa muscular y fuerza".

**Campo "regimen"**: sigue EXACTAMENTE el formato "Régimen {prescripción calórica} {prescripción proteica}."
- Prescripción calórica: la clasificación interna de objetivo de este paciente, ya determinada por el
  sistema, es "${objetivo}". Si es "definicion" usa "hipocalórico"; si es "volumen" usa "hipercalórico";
  si es "mantencion" usa "normocalórico". Esta clasificación interna es solo para construir esta
  palabra: NUNCA debe aparecer literalmente (ej "volumen" o "definicion") en el campo "objetivo".
- Prescripción proteica: usa SIEMPRE "hiperproteico" (el sistema siempre prescribe 1.6gr/kg de peso o
  más de proteína, lo que corresponde siempre a la categoría hiperproteico).
- Ejemplos completos: "Régimen hipocalórico hiperproteico.", "Régimen hipercalórico hiperproteico.",
  "Régimen normocalórico hiperproteico."
`;
}

//Generación del resto del campo tiempos_de_comida: hora, ejemplos, comentarios (paso 3 y 4 doc)
//El campo "alimentos" (con las porciones por grupo) y "aporte" ya vienen calculados por código.
function buildTiemposDeComidaPrompt(tiemposCalculados: TiempoComidaCalculado[]): string {
  const info = tiemposCalculados.map((tiempo, indice) => {
    const alimentos = Object.entries(tiempo.alimentos)
      .filter(([, porciones]) => porciones !== null)
      .map(([campo, porciones]) => {
        const { grupo, subcategoria } = CAMPO_ALIMENTOS_A_GRUPO[campo];
        const grupoData = PORCIONES_GRUPOS_ALIMENTOS.find(
          (g) => g.grupo === grupo && g.subcategoria === subcategoria,
        );
        return {
          campo,
          porciones,
          alimentos_de_ejemplo: grupoData?.alimentos ?? [],
        };
      });

    return { indice, tiempo: tiempo.tiempo, aporte: tiempo.aporte, alimentos };
  });

  return `
### Tiempos de comida

Los tiempos de comida del plan, y las porciones de cada grupo de alimentos que le corresponden a cada
uno, YA FUERON CALCULADOS por el sistema (campo "alimentos" de cada elemento de "info" más abajo): no
los repitas, no los cambies ni los reinterpretes. Tu trabajo es, para cada tiempo de comida, en el mismo
orden en que se entregan, completar:

- "hora": la hora aproximada de ese tiempo de comida (ej "8am", "1pm"), en base a la información
  entregada por el paciente en la consulta (rutina diaria, horario de sesiones deportivas u otro
  contexto disponible). Si no hay información suficiente para estimarla, usa null.
- "ejemplos": exactamente 3 ejemplos concretos de combinaciones de alimentos reales (usando los
  alimentos listados en "alimentos_de_ejemplo" de cada grupo del campo "alimentos", junto con su
  porción/gramaje) que en conjunto cumplan EXACTAMENTE las porciones indicadas en "porciones" de cada
  grupo de ese tiempo.
- "comentarios": observaciones breves relevantes para ese tiempo de comida (ej sugerencias de
  preparación, o advertencias en base a alergias/intolerancias/patologías del paciente). Puede ser una
  lista vacía si no hay observaciones relevantes.

${JSON.stringify(info, null, 2)}
`;
}

//suplementos (paso 5 doc)
function buildSuplementosPrompt(
  supplementsPrescription: SupplementsPrescription,
  adecuacionSuplementos: string | null,
  aporteSuplementoWhey: AporteCalculado,
): string {
  return `
### Suplementos

Debes decidir qué suplementos del objeto "supplementsPrescription" (entregado más abajo, en la sección
"Suplementos disponibles") incluir en el campo 'suplementos' del objeto JSON definido como output.

### Suplemento de proteína (whey protein)
"adecuacionSuplementos" (entregado más abajo) es el resultado del cálculo de adecuación de porciones
(paso 3 doc): si el requerimiento de proteína no se pudo cubrir solo con alimentos, indica cuánto whey
protein hace falta. Debes considerar este objeto, y en caso de que tenga contenido, debes incluir su
contenido en 'suplementos', agregando un objeto con la estructura de supplementPrescription (campos
supplement, requirement, dosageIndication, intakeIndication, effects, considerations, aporte) para el
whey protein indicado. Para el campo "aporte" de ese objeto, usa EXACTAMENTE los valores de
"aporteSuplementoWhey" (entregado más abajo): NO los calcules ni los estimes. El aporte energético de
este suplemento YA está considerado en la adecuación de los tiempos de comida (aporte_plan): no lo
menciones como algo adicional aparte de completar el campo "aporte" del objeto. Si "adecuacionSuplementos"
es null, no agregues ningún suplemento de proteína.

"adecuacionSuplementos": ${JSON.stringify(adecuacionSuplementos)}
"aporteSuplementoWhey": ${JSON.stringify(aporteSuplementoWhey)}

El campo 'deporte' de la consulta (dentro de anamnesis.estilo_vida.deporte) es una LISTA de disciplinas
deportivas practicadas por el paciente. Evalúa CADA disciplina de la lista, por separado, contra los
criterios de inclusión de cada suplemento: si al menos una disciplina de la lista cumple el criterio de
un suplemento, ese suplemento debe incluirse. Pueden calificar varios suplementos a la vez (si distintas
disciplinas de la lista cumplen criterios de distintos suplementos), o ninguno.

NO calcules ni estimes los valores de dosificación: usa EXACTAMENTE los objetos entregados en
"Suplementos disponibles" (campos requirement, dosageIndication, intakeIndication, effects,
considerations, aporte), ya que corresponden a valores ya calculados para este paciente.

Si el campo 'deporte' es null, está vacío, o ninguna disciplina de la lista cumple ningún criterio de
inclusión, el campo 'suplementos' del output debe ser una lista vacía [].

CRITERIOS
-Creatina - criterios de inclusión:
  --Esfuerzos máximos individuales de alta intensidad y corta duración (<30s) como pruebas de velocidad
   (100 y 200 metros planos) o entrenamientos de fuerza (levantamiento de pesas en el gimnasio o halterofilia).
  --Ejercicios de resistencia (como maratón) que involucren sprints de alta intensidad durante o al final de
    una rutina de entrenamiento o competencia.
  --Deportes que involucran rafagas repetidas de esfuerzos de alta intensidad, como deportes de equipo como futbol,
    basquetball, rugby, hockey, o deportes individuales como tenis.
  --Para favorecer la recuperación en periodos de pérdida muscular por desuso, como en casos de lesiones o inmovilización.
-Cafeina - criterios de inclusión:
  --Deportes de resistencia sobre 60 minutos, como ciclismo o running.
  --Deportes breves y sostenidos de alta intensidad como remo (1-60 minutos)
  --Deportes de equipo intermitentes, como futbol, hockey, rugby, basquetball.
  --Esfuerzos únicos que involucran fuerza o potencia, como halterofilia o levantamiento de pesas.
-Nitrato - criterios de inclusión:
  --Ejercicios prolongados de resistenciaa de 4-30min, como running o ciclismo.
  --Deportes intermitentes de alta intensidad y corta duración, como deportes de equipo como futbol, rugby, hockey.
  --En exposición a condiciones de hipoxia, como entrenamiento en altitud.
-Bicarbonato - criterios de inclusión:
  --Eventos de alta intensidad de 1-7min, donde la acumulación de ácido comienza a causar fatiga, como remo, natación y
    carreras de mediana distancia como 800 y 1500 metros en atletismo.
  --Deportes de combate, equipo o raqueta que implican esfuerzos repetitivos de alta intensidad.
  --Deportes de resistencia donde la etapa final implica un amento de la intensidad o remate.

Por ejemplo: Si la lista 'deporte' contiene '100 metros planos', se debe incluir la información del
suplemento creatina, ya que '100 metros planos' coincide con uno de los criterios de aceptación de
creatina, que dice 'Esfuerzos máximos individuales de alta intensidad y corta duración (<30s) como
pruebas de velocidad'. Los 100 metros planos son una prueba de velocidad de alta intensidad, por lo
que este criterio cumple a la perfección. En ese caso, debes incluir el objeto 'creatina' que viene
en "Suplementos disponibles", dentro del campo 'suplementos' del output definido que será devuelto.

Por cada suplemento que cumpla los criterios de aceptación, incluye su objeto supplementPrescription dentro
de la lista de la propiedad 'suplementos' del JSON estructurado que cumple con la estructura de PlanNutricionalDto.

### Suplementos disponibles
${JSON.stringify(supplementsPrescription, null, 2)}
`;
}

//recomendaciones deportivas (paso 6 doc)

// El catálogo completo de códigos de sesión deportiva (SESIONES_DEPORTIVAS).
const CATALOGO_SESIONES_DEPORTIVAS = [
  ...SESIONES_DEPORTIVAS.entrenamiento,
  ...SESIONES_DEPORTIVAS.competencia,
];

// El chat de anamnesis (ver anamnesis.service.ts) usa este objeto sentinela para dejar constancia de
// que el paciente no practica ningún deporte, en vez de dejar sesion_deportiva en null.
function esSesionSentinelaSinDeporte(sesion: NonNullable<EstiloVidaSaludableDto['sesion_deportiva']>[number]): boolean {
  return sesion.tipo_evento === 'no aplica';
}

// Para cada sesión deportiva declarada por el paciente, precalcula -EN CÓDIGO, no en el LLM- la
// recomendación que le correspondería a CADA código del catálogo, usando la duración real de esa
// sesión. recomendacionSesionDeportiva() es una función determinística (tabla de indicaciones +
// cálculo de gramos de carbohidrato por hora); el modelo no puede "ejecutarla" a través de un prompt
// de JSON mode plano (sin function/tool calling), así que el cálculo se hace acá y solo se le entrega
// el resultado ya resuelto, igual que se hace con "Suplementos disponibles" más arriba.
function buildSesionesDeportivasInfo(sesionesDeportivas: EstiloVidaSaludableDto['sesion_deportiva']) {
  const sesionesReales = (sesionesDeportivas ?? []).filter((s) => !esSesionSentinelaSinDeporte(s));
  if (sesionesReales.length === 0) return [];

  return sesionesReales.map((sesion) => ({
    sesion_declarada_por_paciente: sesion,
    opciones_de_codigo: CATALOGO_SESIONES_DEPORTIVAS.map((catalogo) => ({
      codigo: catalogo.codigo,
      tipo: catalogo.tipo,
      descripcion: catalogo.descripcion,
      disciplina: catalogo.disciplina,
      duracion: catalogo.duracion,
      intensidad: catalogo.intensidad,
      recomendacion_para_esta_sesion: recomendacionSesionDeportiva(catalogo.codigo, sesion.duracion ?? 0),
    })),
  }));
}

function buildRecomendacionesDeportivasPrompt(sesionesDeportivas: EstiloVidaSaludableDto['sesion_deportiva']): string {
  const sesionesReales = (sesionesDeportivas ?? []).filter((s) => !esSesionSentinelaSinDeporte(s));
  if (sesionesReales.length === 0) {
    return `
### Recomendaciones deportivas
El paciente no tiene sesiones deportivas registradas (anamnesis.estilo_vida.sesion_deportiva vacío, null,
o marcado como "sin sesiones deportivas"). En ese caso, "recomendaciones_deportivas" del output debe ser
una lista vacía [].
`;
  }

  return `
### Recomendaciones deportivas

Debes generar un objeto de "recomendaciones_deportivas" por cada sesión deportiva del paciente. Más abajo,
en "Sesiones deportivas y opciones de código", se entrega para CADA sesión declarada por el paciente
("sesion_declarada_por_paciente") la lista completa de códigos del catálogo SESIONES_DEPORTIVAS
("opciones_de_codigo"), y para cada código ya viene calculada la recomendación que le correspondería a esa
sesión (campo "recomendacion_para_esta_sesion", con los valores exactos de sesion, estrategia,
pre_actividad, durante_actividad y post_actividad).

Para cada sesión del paciente:
1. Compara "sesion_declarada_por_paciente" contra la descripción de cada elemento de "opciones_de_codigo"
   (campos tipo, descripcion, disciplina, duracion, intensidad), y elige el código que mejor se adecúe,
   basándote principalmente en si es entrenamiento o competencia, la duración y la disciplina.
2. Copia EXACTAMENTE los valores de "recomendacion_para_esta_sesion" del código elegido a los campos
   "estrategia", "pre_actividad", "durante_actividad" y "post_actividad" del objeto de salida. NO calcules,
   inventes ni modifiques estos valores: ya fueron calculados y son la base obligatoria de la recomendación.
3. Completa el campo "sesion" con una breve descripción de la sesión del paciente, ej "entrenamiento de
   pesas" o "entrenamiento de hockey - acondicionamiento".

Para cada objeto de "recomendaciones_deportivas" generado, los campos "sesion", "estrategia",
"pre_actividad", "durante_actividad" y "post_actividad" son OBLIGATORIOS: deben completarse siempre,
sin dejar ninguno vacío ni en null.

### Sesiones deportivas y opciones de código
${JSON.stringify(buildSesionesDeportivasInfo(sesionesDeportivas), null, 2)}
`;
}

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
