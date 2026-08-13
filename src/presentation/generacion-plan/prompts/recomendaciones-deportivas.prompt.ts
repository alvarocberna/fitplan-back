import { EstiloVidaSaludableDto } from '../../../domain/dtos/consulta-completa.dto';
import { SESIONES_DEPORTIVAS, recomendacionSesionDeportiva } from '../../../domain/services/formulas/sesion-deportiva.service';

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

export function buildRecomendacionesDeportivasPrompt(sesionesDeportivas: EstiloVidaSaludableDto['sesion_deportiva']): string {
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
