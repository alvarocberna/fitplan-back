
# Prescripcion de suplementos

- Las reocmendaciones deportivas solo incluyen a los suplementos pertenecientes al grupo A
  acorde al Australian Institute of Sports. Específicamente, suplementos enfocados en la mejora
  de rendimiento deportivo.
- El archivo src/domain/services/formulas/suplementos.service.ts hace el calculo de la dosis de suplementos recomendada
  para el usuario, además entrega la recomendación de ingesta, beneficios y consideraciones. Esto se genera independiente 
  de si se entregará la recomendación.
- El archivo src/presentation/consulta/consulta.prompts.ts evalúa la disciplina del usuario y decide que suplementos deportivos
  son prescritos finalmente.

## Creatina
    - Cuando: Ejercicios de alta intensidad y máximo esfuerzo menores a 30s. Deportes de equipo o raqueta que involucraan esfuerzos 
      repetitivos de alta intensidad. Para apoyar la recuperación en periodos de pérdida de músculo.
    - Disciplinas: Gimnasio. Atletismo 100, 200, 400 y 800m. Futbol. Basquetbol. Voleibol. Hockey. Tenis. Tenis de mesa.
    - Cantidad: 0.03g por kg de peso corporal, la cual es la dosis recomendada estandar. El valor final se redondea al 
      entero o fracción .5 más cercana. Por ejemplo, 2.1 -> 2.5. 2.6 -> 3.0.

## Cafeina
    - Cuando:
    - Cantidad: 1.5mg por kg de peso corporal, cantidad que corresponde a la dosis eficaz más baja. El valor final se redondea
     cada 5 unidades. Por ejemplo, 103 -> 105. 116 -> 120.

## Nitrato
    - Cuando:
    - Cantidad: Se establece una cantidad fija para todos los usuarios correspondiente a 400mg. Se establece este valor ya que las
      guias del Australian Institute of Sports indican un aporte entre 350-600mg. Se establece 400mg ya que es un valor dentro del
      rango y coincide con el aporte de suplementos comerciales, así como 1 betarraga grande (200gr).

## Bicarbonato
    - Cuando:
    - Cantidad: 300mg por kg de peso corporal, cantidad que corresponde al rango intermedio de la recomendación que sugiere randos
      de 200-400mg. Además, se debe acompañar con agua y carbohidratos, cantidad determinada en 10ml por kg de peso corporal, y 
      1.5gr por kg de peso corporal respectivamente.