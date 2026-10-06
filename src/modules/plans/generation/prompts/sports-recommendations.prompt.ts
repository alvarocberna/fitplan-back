import { HealthyLifestyleDto } from '../../../../domain/dtos/consultation.dto';
import { SPORT_SESSIONS, getSportSessionRecommendation } from '../../../../domain/services/formulas/requirements/sport-session.service';

//recomendaciones deportivas (paso 6 doc)

// El catálogo completo de códigos de sesión deportiva (SPORT_SESSIONS).
const SPORT_SESSIONS_CATALOG = [
  ...SPORT_SESSIONS.entrenamiento,
  ...SPORT_SESSIONS.competencia,
];

// El chat de anamnesis (ver consultation.service.ts) usa este objeto sentinela para dejar constancia de
// que el paciente no practica ningún deporte, en vez de dejar sportSession en null.
function isNoSportSentinelSession(session: NonNullable<HealthyLifestyleDto['sportSession']>[number]): boolean {
  return session.eventType === 'no aplica';
}

// Para cada sesión deportiva declarada por el paciente, precalcula -EN CÓDIGO, no en el LLM- la
// recomendación que le correspondería a CADA código del catálogo, usando la duración real de esa
// sesión. getSportSessionRecommendation() es una función determinística (tabla de indicaciones +
// cálculo de gramos de carbohidrato por hora); el modelo no puede "ejecutarla" a través de un prompt
// de JSON mode plano (sin function/tool calling), así que el cálculo se hace acá y solo se le entrega
// el resultado ya resuelto, igual que se hace con "Suplementos disponibles" más arriba.
function buildSportSessionsInfo(sportSessions: HealthyLifestyleDto['sportSession']) {
  const actualSessions = (sportSessions ?? []).filter((s) => !isNoSportSentinelSession(s));
  if (actualSessions.length === 0) return [];

  return actualSessions.map((session) => ({
    reportedSession: session,
    codeOptions: SPORT_SESSIONS_CATALOG.map((catalog) => ({
      code: catalog.code,
      type: catalog.type,
      description: catalog.description,
      discipline: catalog.discipline,
      duration: catalog.duration,
      intensity: catalog.intensity,
      recommendationForThisSession: getSportSessionRecommendation(catalog.code, session.duration ?? 0),
    })),
  }));
}

export function buildSportsRecommendationsPrompt(sportSessions: HealthyLifestyleDto['sportSession']): string {
  const actualSessions = (sportSessions ?? []).filter((s) => !isNoSportSentinelSession(s));
  if (actualSessions.length === 0) {
    return `
### Recomendaciones deportivas
El paciente no tiene sesiones deportivas registradas (anamnesis.lifestyle.sportSession vacío, null,
o marcado como "sin sesiones deportivas"). En ese caso, "sportsRecommendations" del output debe ser
una lista vacía [].
`;
  }

  return `
### Recomendaciones deportivas

Debes generar un objeto de "sportsRecommendations" por cada sesión deportiva del paciente. Más abajo,
en "Sesiones deportivas y opciones de código", se entrega para CADA sesión declarada por el paciente
("reportedSession") la lista completa de códigos del catálogo SPORT_SESSIONS
("codeOptions"), y para cada código ya viene calculada la recomendación que le correspondería a esa
sesión (campo "recommendationForThisSession", con los valores exactos de session, strategy,
preActivity, duringActivity y postActivity).

Para cada sesión del paciente:
1. Compara "reportedSession" contra la descripción de cada elemento de "codeOptions"
   (campos type, description, discipline, duration, intensity), y elige el código que mejor se adecúe,
   basándote principalmente en si es entrenamiento o competencia, la duración y la disciplina.
2. Copia EXACTAMENTE los valores de "recommendationForThisSession" del código elegido a los campos
   "strategy", "preActivity", "duringActivity" y "postActivity" del objeto de salida. NO calcules,
   inventes ni modifiques estos valores: ya fueron calculados y son la base obligatoria de la recomendación.
3. Completa el campo "session" con una breve descripción de la sesión del paciente, ej "entrenamiento de
   pesas" o "entrenamiento de hockey - acondicionamiento".

Para cada objeto de "sportsRecommendations" generado, los campos "session", "strategy",
"preActivity", "duringActivity" y "postActivity" son OBLIGATORIOS: deben completarse siempre,
sin dejar ninguno vacío ni en null.

### Sesiones deportivas y opciones de código
${JSON.stringify(buildSportSessionsInfo(sportSessions), null, 2)}
`;
}
