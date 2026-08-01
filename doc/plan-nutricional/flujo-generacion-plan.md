
# Descripcion

Este archivo documenta el flujo de generación de plan nutricional, el cual ocurre en el archivo `generacion-plan.service.ts` 
en el método procesar. Este método devuelve un objeto PlanNutricionalDto.

A continuación se ve la estructura simplificada del objeto que devuelve el método procesar, indicando por cada campo
1° si la generación actual del campo ocurre por codigo o por IA y 2° como debería generarse el campo (el objetivo final)
El motivo de esto es que hay campos que pueden ser generados por IA de forma correcta, pero otros que no pueden estar 
sujetos a interpretación, y que deben entregar resultados definidos y replicables.

{
    prescripcion: actualmente generado por IA, se debe modificar para generarse por codigo
    tiempos_de_comida {
        descripcion: actualmente generado por IA, lo cual es correcto
        aporte: actualmente generado por IA, se debe modificar para generarse por codigo
        alimentos: actualmente generado por IA, se debe modificar para generarse por codigo
        ejemplos: actualmente generado por IA, lo cual es correcto
    }
    suplementos: actualmente generado por codigo e IA, lo cual es correcto
    recomendaciones_deportivas: actualmente generado por codigo e IA, lo cual es correcto
}

# Flujo generación plan nutricional

## 1. Primero: Cálculo de requerimientos, documentado por el archivo `calculo-requerimientos.md`
    - Actualmente es generado por código, lo cual es correcto.

## 2. Segundo: Prescripcion, documentado en el archivo `prescripcion.md`
    - Actualmente es generado por IA, lo cual es correcto, pero el resultado es incorrecto, por lo que 
      se deben corregir las instrucciones del promp.

## 3. Tercero: Tiempos de comida - adecuación de porciones de alimentos, documentado por el archivo `adecuacion-porciones.md`
    - Actualmente es generado por IA en el promp del archivo `generacion-plan.promp.ts`. Se debe modificar para
      ser generado por código, ya que esta información debe ser replicable, y no sujeta a interpretaciones variables de la IA.

## 4. Cuarto: Ejemplos, documentado por el archivo `generacion-ejemplos.md`
    - Actualmente es generado por IA, lo cual está bien.

## 5. Quinto: Prescripcion de suplementos y recomendaciones deportivas, documentado por el archivo `recomendaciones-deportivas.md`
    - Actualmente 'suplementos' es generado por codigo, pero es la IA quien decide si se prescibe o no, lo cual está bien.
    - Actualmente 'recomendaciones_deportivas' es generado por código, pero es la IA quien decide que recomendación se entrega, lo cual
      está bien.

