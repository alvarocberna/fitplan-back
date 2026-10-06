
# Generación de alimentos equivalentes

Este paso genera el campo `equivalencia` de cada grupo dentro de `alimentos`, en cada elemento de
`tiempos_de_comida` del `PlanNutricionalDto`. Es un complemento de `ejemplos` (ver
`generacion-ejemplos.md`), no un reemplazo: mientras `ejemplos` combina varios grupos en una comida
completa, `equivalencia` es una tabla de sustitución *dentro de un mismo grupo*, para que el paciente
pueda reemplazar el alimento usado en `ejemplos` por otro nutricionalmente equivalente.

Archivos involucrados: los mismos que `generacion-ejemplos.md` (`tiempos-comida.prompt.ts`,
`nutricionista-system.prompt.ts`, `generacion-plan.service.ts`, `adecuacion-porciones.service.ts`,
`porciones-alimentos.ts`), más `src/domain/dtos/plan-nutricional.dto.ts` (define `AlimentoConEquivalencia`).

## Forma final del campo `alimentos`

Antes de este cambio, cada grupo de `alimentos` era directamente el texto de la porción (`"2 porciones"`
o `null`). Ahora cada grupo es `AlimentoConEquivalencia | null`:

```json
"alimentos": {
  "cereales": {
    "porcion": "1 porción",
    "equivalencia": "pan 1/2 unidad (50gr), avena 1/2 taza (40gr), granola 1/2 taza (40gr)"
  },
  "proteinas_baja_en_grasa": {
    "porcion": "2 porciones",
    "equivalencia": "huevo 2 unidades (100gr), jamón de pavo 2 tajadas (100gr), carne 2 trozos de 6x6x1 (100gr)"
  },
  "verduras_libre_consumo": null
}
```

- **`porcion`**: el mismo texto que ya se calculaba por código en el paso 3 (sin cambios).
- **`equivalencia`**: 3 alimentos alternativos de ese mismo grupo, cada uno ya escalado a la misma
  cantidad de porciones que `porcion`, unidos por `", "`. Es nuevo.

## Por qué se genera con el mismo mecanismo que "ejemplos"

Elegir qué 3 alimentos ofrecer como alternativa exige el mismo criterio que elegir alimentos para
`ejemplos` (hábitos por tiempo de comida, alimentos que el paciente ya declaró consumir, exclusiones por
alergias/patologías), así que se le pide a la misma IA, en la misma llamada que genera `ejemplos` (no hay
una segunda llamada al modelo). Y la escalada de porciones tiene el mismo riesgo de error aritmético que
`ejemplos`, así que se valida con la misma lógica: la IA no escribe directamente el texto final de
`alimentos.<grupo>.equivalencia`, sino que reporta un desglose verificable que el código valida antes de
construir ese texto.

## Contrato de salida de la IA

Por cada tiempo de comida, junto a `ejemplos` y `comentarios`, la IA devuelve `equivalencias`: un arreglo
con un objeto por CADA grupo presente en `alimentos` de ese tiempo (ni más ni menos):

```json
{
  "campo": "cereales",
  "opciones": [
    { "texto": "pan 1/2 unidad (50gr)", "alimento": "Pan hallulla", "gramaje": 50 },
    { "texto": "avena 1/2 taza (40gr)", "alimento": "Avena", "gramaje": 40 },
    { "texto": "granola 1/2 taza (40gr)", "alimento": "Granola", "gramaje": 40 }
  ]
}
```

- **`campo`**: el mismo campo del grupo (ej `"cereales"`, `"proteinas_baja_en_grasa"`).
- **`opciones`**: exactamente 3 alimentos DISTINTOS de ese grupo, cada uno redactado y desglosado igual
  que un componente de `ejemplos` (`texto`, `alimento` tal como aparece en el catálogo, `gramaje` total ya
  escalado a las porciones del grupo). A diferencia de `ejemplos`, cada opción es un único alimento (no
  una combinación): no se están armando comidas, solo listando alternativas dentro de un mismo grupo.

Para elegir los 3 alimentos de cada grupo se aplican las MISMAS reglas 3, 4 y 5 de `ejemplos` (prioridad
de alimentos del paciente, exclusiones, hábitos por tiempo de comida) — no se repiten ni se redefinen en
el promp de equivalencias, para evitar que las dos secciones queden desincronizadas.

## Validación en código

`GeneracionPlanService.validarEquivalenciasGeneradas` corre junto a `validarEjemplosGenerados`, después de
recibir la respuesta de la IA. Para cada tiempo de comida y cada grupo con porciones requeridas
(`TiempoComidaCalculado.porcionesNumericas[campo] > 0`):

1. Verifica que exista un objeto de `equivalencias` para ese `campo` (si falta, se rechaza: significa que
   la IA omitió un grupo).
2. Verifica que tenga exactamente 3 `opciones`, y que los 3 `alimento` sean distintos entre sí.
3. Para cada opción, usa el mismo helper `porcionesImplicitas(campo, alimento, gramaje, contexto)` que usa
   `validarEjemplosGenerados`: busca el alimento en `PORCIONES_GRUPOS_ALIMENTOS`, calcula
   `gramaje_reportado ÷ gramaje_de_1_porción`, y verifica que ese resultado calce (tolerancia `0.05`) con
   las porciones exactas requeridas para ese grupo.

Cualquier desajuste lanza `ValidacionPlanError`, capturado por el mismo loop de reintentos de
`generarPlan` que maneja los rechazos de `ejemplos` (ver "Reintentos" en `generacion-ejemplos.md`).

## Merge final

En `procesarPlan`, por cada tiempo de comida se arma un `Map` de `campo -> texto de equivalencia` uniendo
`opciones[].texto` con `", "`. Luego, por cada campo de `TiempoComidaCalculado.alimentos` (el `porcion`
calculado por código en el paso 3): si es `null`, el resultado final es `null`; si tiene valor, el
resultado final es `{ porcion, equivalencia }`, tomando la equivalencia ya validada del `Map` (o `""` si
por algún motivo faltara, aunque eso ya lo debería haber bloqueado la validación anterior).
