
# Descripcion

Este archivo documenta el flujo de generación de plan nutricional, el cual se ejecuta en el archivo `generacion-plan.service.ts` 
en el método 'procesar'. Este método devuelve un objeto PlanNutricionalDto.

A continuación se ve la estructura simplificada del objeto que devuelve el método procesar, indicando por cada campo:
1° si el método de generación actual del campo ocurre por codigo o por IA y 2° el método ideal por el cual debería generarse
este campo, debiendo corregir el método actual por el método ideal declarado. Hay campos que actualmente son generados por IA 
que deben modificarse y generarse en base a código, ya que estos campos deben ser generados de formna replicable, siguiendo 
reglas claras, y no pueden estar sujetos a interpretaciones variables de la IA. 

{
    prescripcion: paso 2, actualmente generado por IA, se debe modificar para generarse por codigo
    tiempos_de_comida {
        descripcion: paso 3, actualmente generado por IA, lo cual es correcto
        aporte: paso 3, actualmente generado por IA, se debe modificar para generarse por codigo
        alimentos: paso 3, actualmente generado por IA, se debe modificar para generarse por codigo
        ejemplos: paso 4, actualmente generado por IA, lo cual es correcto
        comentarios:
    }
    suplementos: paso 5, actualmente generado por codigo e IA, lo cual es correcto
    recomendaciones_deportivas: paso 6, actualmente generado por codigo e IA, lo cual es correcto
}

# Flujo generación plan nutricional

## 1. Paso 1: Cálculo de requerimientos, documentado por el archivo `calculo-requerimientos.md`
    - Actualmente es generado por código, lo cual es correcto.
    - Su resultado se almacena en el campo 'prescripcion'. Además, esta información es base para construir todos
      los otros campos del objeto planNutricional.

## 2. Paso 2: Prescripcion, documentado en el archivo `prescripcion.md`
    - Actualmente es generado por IA, lo cual es correcto, pero el resultado es incorrecto, por lo que 
      se deben corregir las instrucciones del promp.
    - Su resultado se almacena dentro del campo 'prescripcion'.

## 3. Paso 3: Tiempos de comida - adecuación de porciones de alimentos, documentado por el archivo `adecuacion-porciones.md`
    - Actualmente es generado por IA en el promp del archivo `generacion-plan.promp.ts`. Se debe modificar para
      ser generado por código, ya que esta información debe ser replicable, y no sujeta a interpretaciones variables de la IA.
    - Las reglas en la cual debe basarse el código de este paso están definidas en el archivo `adecuacion-porciones.md`

## 4. Paso 4: Ejemplos y comentarios documentado por el archivo `generacion-ejemplos.md` 
    - Actualmente es generado por IA, lo cual está bien.

## 5. Paso 5: Prescripcion de suplementos, documentado por el archivo `suplementos.md`
    - Actualmente la información del campo 'suplementos' es generado por codigo, pero es la IA quien decide 
      si se incluye la prescripción dde suplementos o no, lo cual está bien.

## 6. Paso 6: Recomendaciones deportivas, documentado por el archivo `recomendaciones-deportivas.md`
    - Actualmente 'recomendaciones_deportivas' es generado por código, pero es la IA quien decide si se entrgan
      recomendaciones, y qué recomendación se entrega, lo cual está bien.


