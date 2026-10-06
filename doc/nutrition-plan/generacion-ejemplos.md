
# Generación de ejemplos y comentarios

Este paso genera los campos `ejemplos` y `comentarios` de cada elemento de `tiempos_de_comida` del
`PlanNutricionalDto` (paso 4 del documento `flujo-generacion-plan.md`). Los campos `alimentos` (porciones
por grupo) y `aporte` de ese mismo tiempo de comida NO se generan acá: ya vienen calculados 100% por
código desde `adecuacion-porciones.service.ts` (ver `adecuacion-porciones.md`) y solo se le entregan a la
IA como contexto de solo lectura.

Archivos involucrados:
- `src/modules/generacion-plan/prompts/tiempos-comida.prompt.ts`: arma el promp de esta sección
  (instrucciones + catálogo de alimentos por grupo).
- `src/modules/generacion-plan/prompts/nutricionista-system.prompt.ts`: declara la estructura JSON
  exacta que debe devolver el modelo.
- `src/modules/generacion-plan/generacion-plan.service.ts`: valida la respuesta de la IA
  (`validarEjemplosGenerados`) y arma el resultado final.
- `src/domain/services/alimentos/adecuacion-porciones.service.ts`: calcula, por código, las porciones
  exactas de cada grupo por tiempo de comida (`TiempoComidaCalculado.porcionesNumericas`), que es contra
  lo que se valida la respuesta de la IA.
- `src/domain/services/alimentos/porciones-alimentos.ts`: catálogo `PORCIONES_GRUPOS_ALIMENTOS` (alimentos
  de ejemplo por grupo, con su porción/gramaje base) y `CAMPO_ALIMENTOS_A_GRUPO` (mapeo campo -> grupo).

## Por qué esto sigue siendo un promp para IA (y no código puro)

A diferencia de las porciones (paso 3), elegir *qué alimentos concretos* combinar en un ejemplo requiere
criterio: priorizar lo que el paciente reportó comer, respetar sus alergias/intolerancias/alimentos
evitados, y armar combinaciones realistas según el tiempo de comida (nadie desayuna arroz con pollo). Ese
tipo de juicio no es una tabla de reglas 100% determinística, así que se delega al LLM. Lo que SÍ es
100% determinístico es la aritmética de "cuántos gramos corresponden a N porciones de este alimento": eso
se valida en código (ver más abajo) para que un error de cálculo del modelo nunca llegue al plan final.

## Contrato de salida de la IA

Por cada tiempo de comida, el campo `ejemplos` es un arreglo de exactamente 3 objetos:

```json
{
  "texto": "avena 1/2 taza (40gr) con leche 1 taza (200cc) y huevo duro 2 unidades",
  "componentes": [
    { "campo": "cereales", "alimento": "Avena", "gramaje": 40 },
    { "campo": "lacteos_medio_en_grasa", "alimento": "Leche fluida saborizada", "gramaje": 200 },
    { "campo": "proteinas_baja_en_grasa", "alimento": "Huevo", "gramaje": 100 }
  ]
}
```

- **`texto`**: la redacción libre del ejemplo (lo que finalmente ve el paciente en `ejemplos`). Formato:
  `alimento + porción + gramaje entre paréntesis`, todo en minúscula salvo la primera letra.
- **`componentes`**: el desglose verificable de `texto`. Por cada alimento usado, declara a qué grupo
  pertenece (`campo`), cuál es exactamente (`alimento`, debe coincidir con el catálogo) y cuántos gramos
  totales le asignó (`gramaje` = gramaje de 1 porción de ese alimento × número de porciones que le dio en
  `texto`). Este campo es el que permite validar matemáticamente el ejemplo sin tener que parsear el texto
  libre.

Cada uno de los 3 ejemplos es una alternativa **independiente**: por sí solo debe cubrir EXACTAMENTE las
porciones de cada grupo de ese tiempo (no se suman entre los 3 ejemplos).

## Reglas para elegir alimentos (resumen)

El detalle completo vive en `tiempos-comida.prompt.ts`; resumen de las reglas fijas que se le imponen al
modelo:

1. **Formato**: `alimento + porción + gramaje (entre paréntesis)`, en minúscula.
2. **Escalamiento de porciones** (la causa histórica de errores): cada alimento del catálogo representa 1
   sola porción. Si el grupo requiere N porciones, hay que escalar cantidad y gramaje × N (o combinar
   varios alimentos del mismo grupo cuya suma de porciones dé N).
3. **Prioridad**: usar primero los alimentos que el paciente reportó en su `r24h` o en
   `consumoFrecuente`/`consumoOcasional` de sus preferencias alimentarias, si son saludables.
4. **Exclusiones**: nunca usar alimentos no saludables (azúcar, margarina, etc. — con sus sustitutos
   saludables preferidos: miel, aceite de oliva), ni alimentos declarados como evitados, alérgenos o
   incompatibles con patologías del paciente.
5. **Hábitos por tiempo de comida**: en Cereales, desayuno/colación/once usa solo pan/avena/granola (nunca
   arroz/papa/fideos); almuerzo/cena usa solo arroz/papa/fideos/etc (nunca avena). En Proteínas,
   desayuno/colación/once prioriza huevo/jamón (carne/pollo como máximo en 1 de los 3 ejemplos, nunca
   pescados/mariscos); almuerzo/cena prioriza carne/pollo/pescado (nunca huevo/jamón).
6. **Combinación Cereales + Lácteos** (solo desayuno/colación/once): si el tiempo tiene Cereales, Lácteos
   y Proteínas, al menos 1 de los 3 ejemplos debe combinar el cereal con el lácteo en la misma preparación
   y agregar la proteína como acompañamiento (ej "avena con leche y huevo"), en vez de tratarlos como
   alternativas sueltas. Si no hay grupo Proteínas, evita que cereal y lácteo queden sin relación entre sí
   (ej "pan" y "leche" por separado); si además hay "Ricos en lípidos", se permite tanto la variante
   avena/granola + lácteo + lípido como pan + lípido + lácteo (ej "pan con palta y leche").
7. **Variedad**: los 3 ejemplos de un mismo tiempo no pueden repetir la misma combinación de alimentos.

## Validación en código

`GeneracionPlanService.validarEjemplosGenerados` (en `generacion-plan.service.ts`) corre después de recibir
la respuesta de la IA y antes de armar el plan final. Para cada tiempo de comida y cada uno de sus 3
ejemplos:

1. Verifica que existan exactamente 3 ejemplos.
2. Para cada `componente`, busca el alimento en `PORCIONES_GRUPOS_ALIMENTOS` (vía el helper
   `porcionesImplicitas`, compartido con la validación de equivalencias — ver `generacion-equivalencias.md`)
   y calcula `porciones_implícitas = gramaje_reportado ÷ gramaje_de_1_porción`.
3. Suma esas porciones implícitas por `campo` y las compara contra `TiempoComidaCalculado.porcionesNumericas`
   (el número exacto ya calculado por código en el paso 3), con una tolerancia de `0.05` porciones (solo
   para errores de redondeo de punto flotante).
4. Si algún grupo requerido no aparece, si aparece un grupo que no corresponde a ese tiempo, si un
   `alimento` no pertenece al `campo` declarado, o si la suma de porciones no calza, se lanza un
   `ValidacionPlanError`.

Alimentos del catálogo sin `gramaje` base definido (algunos "libre consumo" como ajo o zapallo italiano
crudo) no se pueden validar en gramos: en ese caso se confía en que el grupo esté cubierto por la sola
presencia del componente.

## Reintentos

`ValidacionPlanError` (y cualquier otro error de la llamada a la IA) es capturado por el loop de
reintentos de `generarPlan` (hasta `MAX_INTENTOS`, con backoff exponencial), que vuelve a pedirle el plan
completo a la IA desde cero. `generarPlan` loggea, por cada intento, cuánto tardó y si fue rechazado
específicamente por esta validación (`rechazosPorValidacion`), para poder diagnosticar si el cuello de
botella es la latencia del modelo o la cantidad de reintentos.

## Merge final

`generado.tiempos_de_comida[i].ejemplos` (ya validado) se transforma al `string[]` final que espera
`PlanNutricionalDto` extrayendo solo `.texto` de cada ejemplo — `componentes` es un artefacto interno de
validación, nunca se persiste ni se le muestra al paciente.
