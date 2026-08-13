import { PORCIONES_GRUPOS_ALIMENTOS, CAMPO_ALIMENTOS_A_GRUPO } from '../../../domain/services/alimentos/porciones-alimentos';
import { TiempoComidaCalculado } from '../../../domain/services/alimentos/adecuacion-porciones.service';

//PASO 3 Y 4 DOC (tiempos de comida + porciones y ejemplos y comentarios)
//El campo "alimentos" (con las porciones por grupo) y "aporte" ya vienen calculados por código.
export function buildTiemposDeComidaPrompt(tiemposCalculados: TiempoComidaCalculado[]): string {
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

- "hora": La hora aproximada de ese tiempo de comida (ej "8am", "1pm"), en base a la información
  entregada por el paciente en la consulta (rutina diaria, horario de sesiones deportivas u otro
  contexto disponible).
  Si no hay información suficiente para estimarla, por defecto entrega los siguientes
  valores para las comidas principales: Desayuno: 8am. Almuerzo: 1pm. Once: 6pm. Cena: 8pm.
  Para las colaciones, si no hay información para determinar su hora, establece una hora intermedia
  entre los dos tiempos de comida principales en que se encuentra. Por ejemplo, si una colación se encuentra
  entre desayuno y almuerzo, su hora será 10am. Si se encuentra entre almuerzo y once o cena, su hora será
  4pm.

- "ejemplos": exactamente 3 objetos con la forma { "texto": string, "componentes": [...] }. Cada uno de
  los 3 es una alternativa de combinación de alimentos INDEPENDIENTE (no se suman entre sí): cada
  ejemplo, por sí solo, debe cumplir EXACTAMENTE las porciones indicadas en "porciones" de cada grupo de
  ese tiempo, usando los alimentos listados en "alimentos_de_ejemplo" de cada grupo.

  "texto" es la redacción del ejemplo (reglas de formato y de qué alimentos elegir más abajo).

  "componentes" es el desglose verificable de "texto": el sistema lo usa para comprobar automáticamente
  que las porciones calzan, y si no calzan exactamente, el ejemplo se RECHAZA y deberás generar el plan
  de nuevo. Por cada alimento que uses en "texto", agrega un objeto { "campo", "alimento", "gramaje" } a
  "componentes":
  - "campo": el mismo valor de "campo" del grupo al que pertenece ese alimento (ej "cereales",
    "proteinas_baja_en_grasa"; ver "info" más abajo).
  - "alimento": el nombre EXACTO del alimento, tal como aparece en "alimentos_de_ejemplo" de ese grupo
    (cópialo literal, sin modificarlo).
  - "gramaje": el gramaje TOTAL que le asignaste a ese alimento en "texto" -el mismo número que escribiste
    entre paréntesis-, NO el gramaje de 1 sola porción. Debe ser matemáticamente consistente: gramaje de
    1 porción de ese alimento (dato "gramaje" del alimento en "alimentos_de_ejemplo") multiplicado por la
    cantidad de porciones que le diste en "texto". Si usas el mismo alimento una sola vez en "texto",
    reporta un único componente para él; si combinas dos alimentos distintos de un mismo grupo, reporta
    un componente por cada uno.
  "componentes" debe reflejar FIELMENTE lo que escribiste en "texto": nunca reportes un gramaje distinto
  al que aparece en el ejemplo, ni omitas un alimento/grupo que sí usaste en "texto".

  Reglas para elegir QUÉ alimentos usar dentro de cada grupo, y cómo redactar "texto" (son reglas fijas,
  no las reinterpretes con tu propio criterio; el objetivo es que los ejemplos sean realistas y jamás
  combinaciones que una persona común no comería):

  1. Cada alimento incluido en "texto" debe seguir una estructura de: alimento + porción + gramaje entre
     parentesis. Ejemplo: Pan hallulla 1 unidad (100gr). El texto debe estar todo en minuscula. A
     excepción de la primera letra (Sentence case).
  2. ESCALAMIENTO DE PORCIONES (regla estricta, es la causa más común de error): cada alimento listado en
     "alimentos_de_ejemplo" de un grupo, con su "porcion" y "gramaje", representa el equivalente de UNA
     sola porción de ese grupo. Si el campo "porciones" de un grupo es mayor a 1, DEBES escalar la
     cantidad/gramaje que reportes en "texto" (y en el "gramaje" del componente correspondiente)
     multiplicándolos por el número de porciones: nunca reportes el gramaje/porción de 1 sola porción
     como si cubriera el total de "porciones" del grupo. Por ejemplo, si el grupo Cereales tiene
     "porciones": 2 y eliges "Arroz cocido" (porción 3/4 taza, 100gr = 1 porción), el ejemplo debe indicar
     el doble: "arroz cocido 1 1/2 taza (200gr)" en "texto", y { "campo": "cereales", "alimento": "Arroz
     cocido", "gramaje": 200 } en "componentes"; si "porciones": 3, sería "arroz cocido 2 1/4 tazas
     (300gr)" y "gramaje": 300. Puedes cubrir el total de "porciones" de dos formas: (a) escalando un
     mismo alimento (cantidad y gramaje x número de porciones), o (b) combinando dos o más alimentos
     distintos del mismo grupo cuya suma de porciones sea igual al total (ej para Cereales con
     "porciones": 2, usar 1 porción de pan + 1 porción de avena, cada uno como su propio componente).
     Verifica siempre, para cada grupo de cada ejemplo, que la suma de porciones de los alimentos usados
     (gramaje reportado ÷ gramaje de 1 porción de ese alimento) sea EXACTAMENTE igual al valor de
     "porciones" de ese grupo, ni más ni menos.
  3. Prioriza los alimentos saludables que el paciente ya declaró consumir. Revisa los campos "r24h" y
     "grupo_preferencias_alimentarias" dentro de "anamnesis.alimentaria", en la sección "Datos de la
     consulta" del mensaje: para cada grupo de alimentos, usa de preferencia los alimentos
     que el paciente reportó en su r24h, o que aparecen en "consumoFrecuente"/"consumoOcasional" de sus
     preferencias alimentarias, siempre que sean saludables y estén dentro de "alimentos_de_ejemplo" de
     ese grupo. Si el paciente no reportó ningún alimento saludable de ese grupo, usa alimentos
     habituales y saludables de "alimentos_de_ejemplo".
  4. Excluye siempre alimentos no saludables o poco recomendables, aunque el paciente los haya
     reportado o aunque aparezcan en "alimentos_de_ejemplo": azúcar, mermelada, dulce de membrillo,
     manjar, jalea en polvo o jugo en polvo (grupo Azucares); margarina, mantequilla, manteca, mayonesa,
     crema o tocino/paté (grupo Aceites y grasas); galletas de soda/agua, chocolates u otros dulces
     como fuente principal de un ejemplo. Si el tiempo de comida tiene un grupo "Azucares", prefiere
     miel de abeja o miel de palma en su lugar; si tiene un grupo "Aceites y grasas", usa un aceite
     saludable (ej aceite de oliva) en vez de margarina/mantequilla. Excluye también
     cualquier alimento que el paciente haya declarado en "alimentosEvitados", o que sea incompatible
     con sus alergias/intolerancias/patologías indicadas en la consulta.
  5. Respeta los hábitos alimentarios reales de la población, según el tiempo de comida (campo
     "tiempo" de cada elemento de "info" más abajo), incluso si eso implica no usar todos los alimentos
     listados en "alimentos_de_ejemplo" de un grupo:
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
     subcategoría) con "porciones" > 0 en ambos:
     - Si ADEMÁS ese tiempo tiene grupo "Proteinas" (alta o baja en grasa) con "porciones" > 0: AL MENOS
       UNO de los 3 ejemplos debe combinar el cereal con el lácteo en la misma preparación, y agregar la
       proteína como acompañamiento del mismo ejemplo (en vez de combinar el cereal con la proteína como
       si fueran alternativas separadas). Ej: "avena 1 taza (80gr) con leche 1 taza (200cc) y huevo duro
       2 unidades", o "avena 1/2 taza (40gr) con leche 1 taza (200cc). Acompañar con 2 rebanadas de pan
       molde (50gr) + 2 huevos". Los otros ejemplos no están obligados a seguir este mismo patrón.
     - Si ese tiempo NO tiene grupo "Proteinas" (solo Cereales + Lácteos, con o sin "Ricos en lípidos"):
       evita ejemplos donde el cereal y el lácteo queden como dos elementos sueltos sin relación entre sí
       (ej "pan 1 unidad" y, por separado, "leche 1 taza", donde el pan no acompaña a nada). Prefiere que
       el cereal se prepare junto con el lácteo, como avena o granola con leche/yogurt. Si además hay
       grupo "Ricos en lípidos" (ej frutos secos, palta) con "porciones" > 0, puedes optar tanto por
       combinaciones de avena/granola + lácteo + el rico en lípidos (ej "avena con leche y nueces"), como
       por combinaciones de pan + el rico en lípidos + el lácteo (ej "pan con palta y leche"), ya que en
       ese caso el rico en lípidos le da sentido al pan como preparación.
  7. Los 3 ejemplos de un mismo tiempo deben ser variados entre sí (no repitas la misma combinación de
     alimentos en los 3), respetando siempre las reglas anteriores y cumpliendo EXACTAMENTE las
     porciones indicadas en "porciones" de cada grupo.

- "equivalencias": un objeto { "campo": string, "opciones": [...] } por CADA grupo que aparece en
  "alimentos" de ese tiempo (uno por cada elemento del arreglo "alimentos" de "info" más abajo, ni más ni
  menos). Es una tabla de sustitución: para cada grupo, 3 alimentos alternativos de ESE MISMO grupo
  (distintos entre sí), cada uno YA escalado para representar, él solo, la misma cantidad de "porciones"
  que tiene ese grupo en ese tiempo (misma regla de ESCALAMIENTO DE PORCIONES que la regla 2 de arriba,
  aplicada a un único alimento en vez de a una combinación). No son parte de ningún "ejemplo": es
  información aparte, independiente de "ejemplos".

  "opciones" es un arreglo de exactamente 3 objetos { "texto", "alimento", "gramaje" }:
  - "texto": el alimento redactado igual que en "ejemplos" (alimento + porción + gramaje entre
    paréntesis, todo en minúscula), ej "avena 1/2 taza (40gr)".
  - "alimento": el nombre EXACTO del alimento tal como aparece en "alimentos_de_ejemplo" de ese grupo.
  - "gramaje": el gramaje TOTAL que le asignaste en "texto" (gramaje de 1 porción de ese alimento x
    número de "porciones" del grupo). Igual que en "componentes" de "ejemplos", debe ser matemáticamente
    consistente: el sistema lo valida y RECHAZA el plan si no calza.

  Para elegir qué 3 alimentos usar en cada grupo, aplica las MISMAS reglas 3, 4 y 5 de arriba (prioriza
  lo que el paciente ya declaró consumir, excluye alimentos no saludables/alérgenos/incompatibles, y
  respeta los hábitos por tiempo de comida: ej en Cereales de desayuno/colación/once nunca uses arroz o
  papa, en Proteinas de desayuno/colación/once prioriza huevo/jamón y usa carne/pollo solo como máximo en
  1 de las 3 opciones). Ejemplo completo para un grupo Cereales con "porciones": "1 porción" en un
  desayuno: opciones = [ { "texto": "pan 1/2 unidad (50gr)", "alimento": "Pan hallulla", "gramaje": 50 },
  { "texto": "avena 1/2 taza (40gr)", "alimento": "Avena", "gramaje": 40 }, { "texto": "granola 1/2 taza
  (40gr)", "alimento": "Granola", "gramaje": 40 } ].

- "comentarios": observaciones breves relevantes para ese tiempo de comida (ej sugerencias de
  preparación, o advertencias en base a alergias/intolerancias/patologías del paciente). Puede ser una
  lista vacía si no hay observaciones relevantes.

${JSON.stringify(info, null, 2)}
`;
}
