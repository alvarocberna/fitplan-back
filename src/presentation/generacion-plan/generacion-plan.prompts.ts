//DOMAIN
import { ConsultaCompletaDto, EstiloVidaSaludableDto } from '../../domain/dtos/consulta-completa.dto';
import { Requerimientos } from '../../domain/services/formulas/requerimientos.service';
import { PORCIONES_GRUPOS_ALIMENTOS } from '../../domain/services/alimentos/porciones-alimentos';
import { SupplementsPrescription } from '../../domain/services/formulas/suplementos.service';
import { SESIONES_DEPORTIVAS, recomendacionSesionDeportiva } from '../../domain/services/formulas/sesion-deportiva.service';

/*
INDICE
Promp global - NUTRICIONISTA_SYSTEM_PROMPT
Promp prescripcion (paso 2 doc) - PRESCRIPCION_PROMPT
Codigo generacion campo alimentos (paso 3 doc)
Promp generacion campo alimentos (paso 3 y 4 doc) - TIEMPOS_DE_COMIDA_PROMPT
Promp con instrucciones de prescripción de suplementos (paso 5 doc)
Promp con instrucciones de prescripción de indicaciones deportivas (paso 6 doc)
Promp para extraer info - EXTRAER_INFO_SYSTEM_PROMPT
*/

export const NUTRICIONISTA_SYSTEM_PROMPT = `Eres un nutricionista experto en nutrición deportiva.
Tu tarea es analizar la información de una consulta (anamnesis y evaluación física de un paciente)
y generar un plan nutricional personalizado.

Debes responder ÚNICAMENTE con un objeto JSON válido (sin texto adicional, sin markdown) que siga
EXACTAMENTE la siguiente estructura:

{
  "prescripcion": {
    "regimen": string,
    "objetivo": string,
    "calorias": number,
    "proteina": number,
    "carbohidrato": number,
    "lipido": number
  },
  "tiempos_de_comida": [
    {
        description: {
            tiempo: string // desayuno | almuerzo | once | cena | colacion
            hora: string | null //ej 10am
        },
        aporte: {
            calorias: number 
            proteina: number 
            carbohidrato: number 
            lipido: number
        },
        alimentos: {
            // Cada campo indica la cantidad de porciones del grupo de alimentos correspondiente
            // (ver sección "Grupos de porciones de alimentos"), ej "1 porción", "2 porciones", "1/2 porción".
            // null si el grupo no se usa en este tiempo de comida.
            cereales: string | null
            verduras_libre_consumo: string | null
            verduras_consumo_general: string | null
            frutas: string | null
            proteinas_alta_en_grasa: string | null
            proteinas_baja_en_grasa: string | null
            lacteos_alto_en_grasa: string | null
            lacteos_medio_en_grasa: string | null
            lacteos_bajo_en_grasa: string | null
            ricos_en_lipidos: string | null
            aceites: string | null
            azucares: string | null
        }
        ejemplos: string[] // 3 ejemplos de combinaciones de alimentos específicos (con su porción) que cumplan "alimentos"
        comentarios: string[] 
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

No incluyas el campo "informacion_personal": ese campo se completa aparte, fuera de tu respuesta.
No incluyas ningún texto fuera del objeto JSON.`;


//PASO 2 DOC
const PRESCRIPCION_PROMPT = `
### Prescripción
Determina el régimen del paciente en base a tu criterio como nutricionista deportivo,
usando los datos de evaluación física y anamnesis entregados.
Para "calorias", "proteina", "carbohidrato" y "lipido" NO los calcules ni los estimes:
usa EXACTAMENTE los valores entregados en la sección "Requerimientos nutricionales"
(campos energia, proteina, carbohidrato y lipido respectivamente), ya que corresponden
a los requerimientos nutricionales ya calculados para este paciente y son la base
obligatoria del plan.
`;

//Generación campo alimentos con grupos de aliemtos x tiempo de comida (paso 3 doc)

// Mapea cada campo del objeto "alimentos" de un tiempo de comida al grupo/subcategoría
// de PORCIONES_GRUPOS_ALIMENTOS que le corresponde.
const CAMPO_ALIMENTOS_A_GRUPO: Record<string, { grupo: string; subcategoria: string | null }> = {
  cereales: { grupo: 'Cereales', subcategoria: null },
  verduras_consumo_general: { grupo: 'Verduras', subcategoria: 'Consumo general' },
  verduras_libre_consumo: { grupo: 'Verduras', subcategoria: 'Libre consumo' },
  frutas: { grupo: 'Frutas', subcategoria: null },
  proteinas_alta_en_grasa: { grupo: 'Proteinas', subcategoria: 'Alta en grasa' },
  proteinas_baja_en_grasa: { grupo: 'Proteinas', subcategoria: 'Baja en grasa' },
  lacteos_bajo_en_grasa: { grupo: 'Lácteos', subcategoria: 'Bajo en grasas' },
  lacteos_medio_en_grasa: { grupo: 'Lácteos', subcategoria: 'Medios en grasas' },
  lacteos_alto_en_grasa: { grupo: 'Lácteos', subcategoria: 'Altos en grasas' },
  ricos_en_lipidos: { grupo: 'Ricos en lípidos', subcategoria: null },
  aceites: { grupo: 'Aceites y grasas', subcategoria: null },
  azucares: { grupo: 'Azucares', subcategoria: null },
};

// Arma, para cada campo del objeto "alimentos", el aporte por porción del grupo
// correspondiente y algunos alimentos de ejemplo con su porción, para que el modelo
// pueda calcular cuántas porciones de cada grupo corresponden y con qué alimentos
// concretos ilustrar los ejemplos.
function buildGruposAlimentosInfo() {
  return Object.fromEntries(
    Object.entries(CAMPO_ALIMENTOS_A_GRUPO).map(([campo, { grupo, subcategoria }]) => {
      const grupoData = PORCIONES_GRUPOS_ALIMENTOS.find(
        (g) => g.grupo === grupo && g.subcategoria === subcategoria,
      );
      return [
        campo,
        {
          grupo,
          subcategoria,
          aporte_por_porcion: grupoData?.aporte_por_porcion ?? null,
          alimentos_de_ejemplo: grupoData?.alimentos ?? [],
        },
      ];
    }),
  );
}

const TIEMPOS_DE_COMIDA_PROMPT = `
### Tiempos de comida
Determina los tiempos de comida del plan.
Por ahora, genera un número de tiempos de comida razonable en base al r24h entregado por el paciente,
y distribuye entre ellos las calorías/macronutrientes de la prescripción.

Para el campo "alimentos" de cada tiempo de comida:
- NO indiques alimentos específicos (ej "1 pan", "media palta"). En su lugar, indica la CANTIDAD DE
  PORCIONES del grupo de alimentos correspondiente a cada campo, ej "1 porción", "2 porciones", "1/2 porción".
- Usa la sección "Grupos de porciones de alimentos" para saber el aporte nutricional (energía, proteína,
  carbohidrato, lípido) de una porción de cada grupo/subcategoría.
- Calcula el número de porciones de cada grupo de forma que la suma de sus aportes se aproxime al "aporte"
  (calorías, proteína, carbohidrato, lípido) definido para ese tiempo de comida.
- Deja en null los campos de grupos que no se usen en ese tiempo de comida.

Para el campo "ejemplos": da 3 ejemplos concretos de combinaciones de alimentos (usando los alimentos
listados en "alimentos_de_ejemplo" de cada grupo, junto con su porción/gramaje) que en conjunto cumplan
exactamente las cantidades de porciones indicadas en "alimentos".
`;

//suplementos (paso 5 doc)
function buildSuplementosPrompt(supplementsPrescription: SupplementsPrescription): string {
  return `
### Suplementos

Debes decidir qué suplementos del objeto "supplementsPrescription" (entregado más abajo, en la sección
"Suplementos disponibles") incluir en el campo 'suplementos' del objeto JSON definido como output.

El campo 'deporte' de la consulta (dentro de anamnesis.estilo_vida.deporte) es una LISTA de disciplinas
deportivas practicadas por el paciente. Evalúa CADA disciplina de la lista, por separado, contra los
criterios de inclusión de cada suplemento: si al menos una disciplina de la lista cumple el criterio de
un suplemento, ese suplemento debe incluirse. Pueden calificar varios suplementos a la vez (si distintas
disciplinas de la lista cumplen criterios de distintos suplementos), o ninguno.

NO calcules ni estimes los valores de dosificación: usa EXACTAMENTE los objetos entregados en
"Suplementos disponibles" (campos requirement, dosageIndication, intakeIndication, effects,
considerations), ya que corresponden a valores ya calculados para este paciente.

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

export function buildUserPrompt(consulta: ConsultaCompletaDto, requerimientos: Requerimientos, supplementsPrescription: SupplementsPrescription): string {
  return `A continuación se entrega la información de la consulta de un paciente. Genera el plan
nutricional siguiendo estas instrucciones para cada sección:

${PRESCRIPCION_PROMPT}

${TIEMPOS_DE_COMIDA_PROMPT}

${buildSuplementosPrompt(supplementsPrescription)}

${buildRecomendacionesDeportivasPrompt(consulta.anamnesis?.estilo_vida?.sesion_deportiva ?? null)}

### Grupos de porciones de alimentos
Para cada campo del objeto "alimentos" de un tiempo de comida, esta es la información del grupo/subcategoría
que le corresponde: el aporte nutricional de una porción ("aporte_por_porcion") y alimentos de ejemplo con
su porción y gramaje ("alimentos_de_ejemplo"), a usar solo en la sección "ejemplos".
${JSON.stringify(buildGruposAlimentosInfo(), null, 2)}

### Requerimientos nutricionales (base obligatoria de la prescripción)
${JSON.stringify(requerimientos, null, 2)}

### Datos de la consulta (anamnesis y evaluación física)
${JSON.stringify({ anamnesis: consulta.anamnesis, evaluacionFisica: consulta.mediciones }, null, 2)}`;
}
