import {
  FOOD_GROUP_PORTIONS,
  FOOD_FIELD_TO_GROUP,
} from '../../../../domain/services/alimentos/food-portions';
import { CalculatedMealTime } from '../../../../domain/services/alimentos/portion-adequacy.service';

// Datos ya calculados de cada tiempo de comida que se le entregan al modelo: su índice, las porciones
// de cada grupo y los alimentos permitidos ("exampleFoods") con su gramaje de 1 porción. Lo usan el
// prompt de generación (todos los tiempos) y el de corrección (solo los que tuvieron errores).
export function buildMealTimesInfo(calculatedMealTimes: CalculatedMealTime[]) {
  return calculatedMealTimes.map((mealTime, index) => {
    const foods = (Object.entries(mealTime.foods) as [string, string | null][])
      .filter(([, portions]) => portions !== null)
      .map(([field, portions]) => {
        const { group, subcategory } = FOOD_FIELD_TO_GROUP[field];
        const groupData = FOOD_GROUP_PORTIONS.find(
          (g) => g.group === group && g.subcategory === subcategory,
        );
        return {
          field,
          portions,
          exampleFoods: groupData?.foods ?? [],
        };
      });
    return {
      index,
      mealTime: mealTime.mealTimeType,
      intake: mealTime.intake,
      foods,
    };
  });
}

// Reglas de redacción de un tiempo de comida (hora, ejemplos, equivalencias, comentarios). Son las
// mismas para generar el plan y para corregir una comida: por eso viven en una constante compartida.
export const MEAL_TIMES_INSTRUCTIONS = `
### Tiempos de comida

Los tiempos de comida del plan, y las porciones de cada grupo de alimentos que le corresponden a cada
uno, YA FUERON CALCULADOS por el sistema (campo "foods" de cada elemento de "info" más abajo): no
los repitas, no los cambies ni los reinterpretes. Tu trabajo es, para cada tiempo de comida, en el mismo
orden en que se entregan, completar:

- "hour": La hora aproximada de ese tiempo de comida (ej "8am", "1pm"), en base a la información
  entregada por el paciente en la consulta (rutina diaria, horario de sesiones deportivas u otro
  contexto disponible).
  Si no hay información suficiente para estimarla, por defecto entrega los siguientes
  valores para las comidas principales: Desayuno: 8am. Almuerzo: 1pm. Once: 6pm. Cena: 8pm.
  Para las colaciones, si no hay información para determinar su hora, establece una hora intermedia
  entre los dos tiempos de comida principales en que se encuentra. Por ejemplo, si una colación se encuentra
  entre desayuno y almuerzo, su hora será 10am. Si se encuentra entre almuerzo y once o cena, su hora será
  4pm.

- "examples": exactamente 3 objetos con la forma { "text": string, "components": [...] }. Cada uno de
  los 3 es una alternativa de combinación de alimentos INDEPENDIENTE (no se suman entre sí): cada
  ejemplo, por sí solo, debe cumplir EXACTAMENTE las porciones indicadas en "portions" de cada grupo de
  ese tiempo, usando los alimentos listados en "exampleFoods" de cada grupo.

  "text" es la redacción del ejemplo (reglas de formato y de qué alimentos elegir más abajo).

  "components" es el desglose verificable de "text": el sistema lo usa para comprobar automáticamente
  que las porciones calzan, y si no calzan exactamente, el ejemplo se RECHAZA y deberás generar el plan
  de nuevo. Por cada alimento que uses en "text", agrega un objeto { "field", "food", "weight" } a
  "components":
  - "field": el mismo valor de "field" del grupo al que pertenece ese alimento (ej "cereals",
    "lowFatProteins"; ver "info" más abajo).
  - "food": el nombre EXACTO del alimento, tal como aparece en "exampleFoods" de ese grupo
    (cópialo literal, sin modificarlo).
  - "weight": el gramaje TOTAL que le asignaste a ese alimento en "text" -el mismo número que escribiste
    entre paréntesis-, NO el gramaje de 1 sola porción. Debe ser matemáticamente consistente: gramaje de
    1 porción de ese alimento (dato "weight" del alimento en "exampleFoods") multiplicado por la
    cantidad de porciones que le diste en "text". Si usas el mismo alimento una sola vez en "text",
    reporta un único componente para él; si combinas dos alimentos distintos de un mismo grupo, reporta
    un componente por cada uno.
  "components" debe reflejar FIELMENTE lo que escribiste en "text": nunca reportes un gramaje distinto
  al que aparece en el ejemplo, ni omitas un alimento/grupo que sí usaste en "text".

  Reglas para elegir QUÉ alimentos usar dentro de cada grupo, y cómo redactar "text" (son reglas fijas,
  no las reinterpretes con tu propio criterio; el objetivo es que los ejemplos sean realistas y jamás
  combinaciones que una persona común no comería):

  1. Cada alimento incluido en "text" debe seguir una estructura de: alimento + porción + gramaje entre
     parentesis. Ejemplo: Pan hallulla 1 unidad (100gr). El texto debe estar todo en minuscula. A
     excepción de la primera letra (Sentence case).
  2. ESCALAMIENTO DE PORCIONES (regla estricta, es la causa más común de error): cada alimento listado en
     "exampleFoods" de un grupo, con su "portion" y "weight", representa el equivalente de UNA
     sola porción de ese grupo. Si el campo "portions" de un grupo es mayor a 1, DEBES escalar la
     cantidad/gramaje que reportes en "text" (y en el "weight" del componente correspondiente)
     multiplicándolos por el número de porciones: nunca reportes el gramaje/porción de 1 sola porción
     como si cubriera el total de "portions" del grupo. Por ejemplo, si el grupo Cereales tiene
     "portions": 2 y eliges "Arroz cocido" (porción 3/4 taza, 100gr = 1 porción), el ejemplo debe indicar
     el doble: "arroz cocido 1 1/2 taza (200gr)" en "text", y { "field": "cereals", "food": "Arroz
     cocido", "weight": 200 } en "components"; si "portions": 3, sería "arroz cocido 2 1/4 tazas
     (300gr)" y "weight": 300. Puedes cubrir el total de "portions" de dos formas: (a) escalando un
     mismo alimento (cantidad y gramaje x número de porciones), o (b) combinando dos o más alimentos
     distintos del mismo grupo cuya suma de porciones sea igual al total (ej para Cereales con
     "portions": 2, usar 1 porción de pan + 1 porción de avena, cada uno como su propio componente).
     Verifica siempre, para cada grupo de cada ejemplo, que la suma de porciones de los alimentos usados
     (gramaje reportado ÷ gramaje de 1 porción de ese alimento) sea EXACTAMENTE igual al valor de
     "portions" de ese grupo, ni más ni menos.
  3. Prioriza los alimentos saludables que el paciente ya declaró consumir. Revisa los campos "r24h" y
     "foodPreferenceGroups" dentro de "anamnesis.dietary", en la sección "Datos de la
     consulta" del mensaje: para cada grupo de alimentos, usa de preferencia los alimentos
     que el paciente reportó en su r24h, o que aparecen en "frequentConsumption"/"occasionalConsumption" de sus
     preferencias alimentarias, siempre que sean saludables y estén dentro de "exampleFoods" de
     ese grupo. Si el paciente no reportó ningún alimento saludable de ese grupo, usa alimentos
     habituales y saludables de "exampleFoods".
  4. Excluye siempre alimentos no saludables o poco recomendables, aunque el paciente los haya
     reportado o aunque aparezcan en "exampleFoods": azúcar, mermelada, dulce de membrillo,
     manjar, jalea en polvo o jugo en polvo (grupo Azucares); margarina, mantequilla, manteca, mayonesa,
     crema o tocino/paté (grupo Aceites y grasas); galletas de soda/agua, chocolates u otros dulces
     como fuente principal de un ejemplo. Si el tiempo de comida tiene un grupo "Azucares", prefiere
     miel de abeja o miel de palma en su lugar; si tiene un grupo "Aceites y grasas", usa un aceite
     saludable (ej aceite de oliva) en vez de margarina/mantequilla. Excluye también
     cualquier alimento que el paciente haya declarado en "avoidedFoods", o que sea incompatible
     con sus alergias/intolerancias/patologías indicadas en la consulta.
  5. Respeta los hábitos alimentarios reales de la población, según el tiempo de comida (campo
     "mealTime" de cada elemento de "info" más abajo), incluso si eso implica no usar todos los alimentos
     listados en "exampleFoods" de un grupo:
     - Desayuno, colación y once: en el grupo Cereales usa SOLO pan, avena, granola u otros alimentos propios de
       desayuno/colación/once. NUNCA uses arroz, fideos, papa, quinoa, cuscús ni choclo en estos tiempos,
       aunque pertenezcan al mismo grupo Cereales: esos son alimentos propios de almuerzo/cena. En el
       grupo Proteinas (alta o baja en grasa) usa preferentemente huevo o jamón (de pavo); carne o
       pollo pueden aparecer solo ocasionalmente (como máximo en uno de los 3 ejemplos); pescados y
       mariscos (ej merluza, reineta, jurel, atún, choritos, jaiva, almejas, piure, loco) NUNCA deben
       aparecer en desayuno, colación ni once.
     - Almuerzo y cena: en el grupo Cereales usa SOLO arroz, fideos, papa, quinoa, cuscús, choclo u
       otros alimentos propios de almuerzo/cena. NUNCA uses avena en estos tiempos; pan solo puede
       aparecer si el ejemplo completo tiene forma de sandwich (con su proteína y verduras correspon-
       dientes), nunca como acompañamiento suelto. En el grupo Proteinas usa preferentemente carne,
       pollo, pescados o mariscos; huevo o jamón NO deben aparecer en almuerzo ni cena.
  6. COMBINACIÓN CEREALES + LÁCTEOS (solo aplica a Desayuno, colación y once; NO a almuerzo/cena): cuando
     ese tiempo de comida tenga simultáneamente grupo "Cereales" y grupo "Lácteos" (cualquier
     subcategoría) con "portions" > 0 en ambos:
     - Si ADEMÁS ese tiempo tiene grupo "Proteinas" (alta o baja en grasa) con "portions" > 0: AL MENOS
       UNO de los 3 ejemplos debe combinar el cereal con el lácteo en la misma preparación, y agregar la
       proteína como acompañamiento del mismo ejemplo (en vez de combinar el cereal con la proteína como
       si fueran alternativas separadas). Ej: "avena 1 taza (80gr) con leche 1 taza (200cc) y huevo duro
       2 unidades", o "avena 1/2 taza (40gr) con leche 1 taza (200cc). Acompañar con 2 rebanadas de pan
       molde (50gr) + 2 huevos". Los otros ejemplos no están obligados a seguir este mismo patrón.
     - Si ese tiempo NO tiene grupo "Proteinas" (solo Cereales + Lácteos, con o sin "Ricos en lípidos"):
       evita ejemplos donde el cereal y el lácteo queden como dos elementos sueltos sin relación entre sí
       (ej "pan 1 unidad" y, por separado, "leche 1 taza", donde el pan no acompaña a nada). Prefiere que
       el cereal se prepare junto con el lácteo, como avena o granola con leche/yogurt. Si además hay
       grupo "Ricos en lípidos" (ej frutos secos, palta) con "portions" > 0, puedes optar tanto por
       combinaciones de avena/granola + lácteo + el rico en lípidos (ej "avena con leche y nueces"), como
       por combinaciones de pan + el rico en lípidos + el lácteo (ej "pan con palta y leche"), ya que en
       ese caso el rico en lípidos le da sentido al pan como preparación.
  7. Los 3 ejemplos de un mismo tiempo deben ser variados entre sí (no repitas la misma combinación de
     alimentos en los 3), respetando siempre las reglas anteriores y cumpliendo EXACTAMENTE las
     porciones indicadas en "portions" de cada grupo.

- "equivalences": un objeto { "field": string, "options": [...] } por CADA grupo que aparece en
  "foods" de ese tiempo (uno por cada elemento del arreglo "foods" de "info" más abajo, ni más ni
  menos). Es una tabla de sustitución: para cada grupo, 3 alimentos alternativos de ESE MISMO grupo
  (distintos entre sí), cada uno YA escalado para representar, él solo, la misma cantidad de "portions"
  que tiene ese grupo en ese tiempo (misma regla de ESCALAMIENTO DE PORCIONES que la regla 2 de arriba,
  aplicada a un único alimento en vez de a una combinación). No son parte de ningún "example": es
  información aparte, independiente de "examples".

  "options" es un arreglo de exactamente 3 objetos { "text", "food", "weight" }:
  - "text": el alimento redactado igual que en "examples" (alimento + porción + gramaje entre
    paréntesis, todo en minúscula), ej "avena 1/2 taza (40gr)".
  - "food": el nombre EXACTO del alimento tal como aparece en "exampleFoods" de ese grupo.
  - "weight": el gramaje TOTAL que le asignaste en "text" (gramaje de 1 porción de ese alimento x
    número de "portions" del grupo). Igual que en "components" de "examples", debe ser matemáticamente
    consistente: el sistema lo valida y RECHAZA el plan si no calza.

  Para elegir qué 3 alimentos usar en cada grupo, aplica las MISMAS reglas 3, 4 y 5 de arriba (prioriza
  lo que el paciente ya declaró consumir, excluye alimentos no saludables/alérgenos/incompatibles, y
  respeta los hábitos por tiempo de comida: ej en Cereales de desayuno/colación/once nunca uses arroz o
  papa, en Proteinas de desayuno/colación/once prioriza huevo/jamón y usa carne/pollo solo como máximo en
  1 de las 3 opciones). Ejemplo completo para un grupo Cereales con "portions": "1 porción" en un
  desayuno: options = [ { "text": "pan 1/2 unidad (50gr)", "food": "Pan hallulla", "weight": 50 },
  { "text": "avena 1/2 taza (40gr)", "food": "Avena", "weight": 40 }, { "text": "granola 1/2 taza
  (40gr)", "food": "Granola", "weight": 40 } ].

- "comments": observaciones breves relevantes para ese tiempo de comida (ej sugerencias de
  preparación, o advertencias en base a alergias/intolerancias/patologías del paciente). Puede ser una
  lista vacía si no hay observaciones relevantes.
`;

//PASO 3 Y 4 DOC (tiempos de comida + porciones y ejemplos y comentarios)
//El campo "foods" (con las porciones por grupo) y "intake" ya vienen calculados por código.
export function buildMealTimesPrompt(
  calculatedMealTimes: CalculatedMealTime[],
): string {
  return `${MEAL_TIMES_INSTRUCTIONS}
${JSON.stringify(buildMealTimesInfo(calculatedMealTimes), null, 2)}
`;
}
