import { SupplementsPrescription } from '../../../domain/services/formulas/supplements.service';
import { CalculatedIntake } from '../../../domain/services/alimentos/portion-adequacy.service';

//suplementos (paso 5 doc)
export function buildSupplementsPrompt(
  supplementsPrescription: SupplementsPrescription,
  supplementIntakeNote: string | null,
  wheyIntake: CalculatedIntake,
): string {
  return `
### Suplementos

Debes decidir qué suplementos del objeto "supplementsPrescription" (entregado más abajo, en la sección
"Suplementos disponibles") incluir en el campo 'supplements' del objeto JSON definido como output.

### Suplemento de proteína (whey protein)
"supplementIntakeNote" (entregado más abajo) es el resultado del cálculo de adecuación de porciones
(paso 3 doc): si el requerimiento de proteína no se pudo cubrir solo con alimentos, indica cuánto whey
protein hace falta. Debes considerar este objeto, y en caso de que tenga contenido, debes incluir su
contenido en 'supplements', agregando un objeto con la estructura de supplementPrescription (campos
supplement, requirement, dosageIndication, intakeIndication, effects, considerations, intake) para el
whey protein indicado. Para el campo "intake" de ese objeto, usa EXACTAMENTE los valores de
"wheyIntake" (entregado más abajo): NO los calcules ni los estimes. El aporte energético de
este suplemento YA está considerado en la adecuación de los tiempos de comida (planIntake): no lo
menciones como algo adicional aparte de completar el campo "intake" del objeto. Si "supplementIntakeNote"
es null, no agregues ningún suplemento de proteína.

"supplementIntakeNote": ${JSON.stringify(supplementIntakeNote)}
"wheyIntake": ${JSON.stringify(wheyIntake)}

El campo 'sport' de la consulta (dentro de anamnesis.lifestyle.sport) es una LISTA de disciplinas
deportivas practicadas por el paciente. Evalúa CADA disciplina de la lista, por separado, contra los
criterios de inclusión de cada suplemento: si al menos una disciplina de la lista cumple el criterio de
un suplemento, ese suplemento debe incluirse. Pueden calificar varios suplementos a la vez (si distintas
disciplinas de la lista cumplen criterios de distintos suplementos), o ninguno.

NO calcules ni estimes los valores de dosificación: usa EXACTAMENTE los objetos entregados en
"Suplementos disponibles" (campos requirement, dosageIndication, intakeIndication, effects,
considerations, intake), ya que corresponden a valores ya calculados para este paciente.

Si el campo 'sport' es null, está vacío, o ninguna disciplina de la lista cumple ningún criterio de
inclusión, el campo 'supplements' del output debe ser una lista vacía [].

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

Por ejemplo: Si la lista 'sport' contiene '100 metros planos', se debe incluir la información del
suplemento creatina, ya que '100 metros planos' coincide con uno de los criterios de aceptación de
creatina, que dice 'Esfuerzos máximos individuales de alta intensidad y corta duración (<30s) como
pruebas de velocidad'. Los 100 metros planos son una prueba de velocidad de alta intensidad, por lo
que este criterio cumple a la perfección. En ese caso, debes incluir el objeto 'creatina' que viene
en "Suplementos disponibles", dentro del campo 'supplements' del output definido que será devuelto.

Por cada suplemento que cumpla los criterios de aceptación, incluye su objeto supplementPrescription dentro
de la lista de la propiedad 'supplements' del JSON estructurado que cumple con la estructura de NutritionPlanDto.

### Suplementos disponibles
${JSON.stringify(supplementsPrescription, null, 2)}
`;
}
