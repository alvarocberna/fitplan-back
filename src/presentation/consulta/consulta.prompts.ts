import { ConsultaCompletaDto } from '../../domain/dtos/consulta-completa.dto';

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
      "tiempo": string, // "desayuno" | "almuerzo" | "once" | "cena" | "colacion"
      "hora": string | null,
      "calorias": number,
      "proteina": number,
      "carbohidrato": number,
      "lipido": number,
      "cereales": string | null,
      "verdura_libre_consumo": string | null,
      "verdura_consumo_general": string | null,
      "fruta": string | null,
      "proteina_alta_en_grasa": string | null,
      "proteina_baja_en_grasa": string | null,
      "lacteo_alto_en_grasa": string | null,
      "lacteo_medio_en_grasa": string | null,
      "lacteo_bajo_en_grasa": string | null,
      "rico_en_lipidos": string | null,
      "aceite": string | null,
      "azucar": string | null,
      "ejemplos": string[], // 3 ejemplos de comida para este tiempo
      "comentarios": string[]
    }
  ],
  "suplementos": [
    {
      "suplemento": string | null,
      "recomendacion": string | null
    }
  ],
  "recomendaciones_deportivas": [
    {
      "sesion": string | null,
      "estrategia": string | null,
      "pre_actividad": string | null,
      "durante_actividad": string | null,
      "post_actividad": string | null
    }
  ]
}

No incluyas el campo "informacion_personal": ese campo se completa aparte, fuera de tu respuesta.
No incluyas ningún texto fuera del objeto JSON.`;

// TODO: reemplazar por las fórmulas definitivas para calcular régimen, objetivo,
// calorías totales y distribución de macronutrientes (proteína, carbohidrato, lípido)
// en base a la evaluación física (peso, talla) y a la anamnesis (objetivo, nivel de
// actividad física, etc).
const PRESCRIPCION_PROMPT = `### Prescripción
Calcula el régimen, objetivo, calorías totales y distribución de macronutrientes
(proteína, carbohidrato, lípido) del paciente.
Por ahora, realiza una estimación general razonable en base a tu criterio como
nutricionista deportivo, usando los datos de evaluación física y anamnesis entregados.`;

// TODO: reemplazar por las reglas definitivas que determinan cuántos tiempos de
// comida generar (desayuno, almuerzo, colación, once, cena, etc), cómo distribuir
// calorías/macronutrientes entre ellos, y cómo determinar los intercambios de
// alimentos (cereales, verduras, frutas, proteínas, lácteos, grasas, azúcares) en
// cada uno.
const TIEMPOS_DE_COMIDA_PROMPT = `### Tiempos de comida
Determina los tiempos de comida del plan y su contenido.
Por ahora, genera un número de tiempos de comida razonable en base al r24h
entregado por el paciente, junto con 3 ejemplos y comentarios relevantes para cada uno.`;

// TODO: reemplazar por las reglas definitivas para recomendar (o no) suplementos
// deportivos según el objetivo, tipo de entrenamiento y los suplementos ya
// declarados por el paciente en la estrategia deportiva.
const SUPLEMENTOS_PROMPT = `### Suplementos
Determina qué suplementos recomendar y sus indicaciones de uso.
Por ahora, entrega recomendaciones generales en base a la estrategia_deportiva y
los objetivos declarados por el paciente.`;

// TODO: reemplazar por las reglas definitivas para construir las recomendaciones
// antes, durante y después de cada sesión de entrenamiento, según el tipo,
// frecuencia y duración de las sesiones reportadas.
const RECOMENDACIONES_DEPORTIVAS_PROMPT = `### Recomendaciones deportivas
Determina las recomendaciones deportivas asociadas a las sesiones de entrenamiento
del paciente.
Por ahora, entrega recomendaciones generales en base a la sesion_entrenamiento y la
estrategia_deportiva declaradas.`;

export function buildUserPrompt(consulta: ConsultaCompletaDto): string {
  return `A continuación se entrega la información de la consulta de un paciente. Genera el plan
nutricional siguiendo estas instrucciones para cada sección:

${PRESCRIPCION_PROMPT}

${TIEMPOS_DE_COMIDA_PROMPT}

${SUPLEMENTOS_PROMPT}

${RECOMENDACIONES_DEPORTIVAS_PROMPT}

### Datos de la consulta (anamnesis y evaluación física)
${JSON.stringify({ anamnesis: consulta.anamnesis, evaluacionFisica: consulta.mediciones }, null, 2)}`;
}
