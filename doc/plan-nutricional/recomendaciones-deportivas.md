
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


# Recomendaciones deportivas por día de entrenamiento

## Flujo
- El modelo de opanai debe analizar el campo 'deporte' y 'sesion_entrenamiento' anidados en el objeto consultaCompleta.
  En base al tipo de deporte y caracteristicas de la sesión, como disciplina, duración, intensidad, si es entrenamiento o competencia, 
  el LLM debe comparar las caracteristicas de la sesion con las caracteristicas de SESIONES_DEPORTIVAS, y determinar a qué sesión
  se adecúa más, caso en el cual debe devolver el código de la sesión. 
- Luego de analizar la sesión deportiva y determinar a cual se adecúa más, se llama a la función recomendacionSesionDeportiva()
  que recibe como argumentos el código de la sesión y la duración de la sesión deportiva, devolviendo un objeto con las indicaciones
  para la sesión deportiva.

## Calculos
- Las recomendaciones deportivas están dictadas acorde a las recomendaciones del American College of Sports Medicine (ACSM),
  que dentro de sus guias indican:
  -- Para sesiones bajo los 45min no se requiere aporte externo de carbohidratos.
  -- Para sesiones de 45-75 minutos pequeñas dosis de carbohidrato o enjuague bucal pueden ser efectivos para aumentar
  la energía. Para este proyecto se utilizó el rango de 45-59 minutos.
  -- Sesiones entre 1h y 2.5h requieren entre 30-60gr de carbohidrato por hora. Esto está abierto a interpretación, por lo que 
  se decidió entregar las siguientes recomendaciones:
    --60-89 minutos: 30 gr/h.
    --90-119 minutos: 45 gr/h.
    --120 minutos o más: 60 gr/h
    Esta desición se fundamenta en que en 1 hora de entrenamiento las reservas de glucógeno estarán levemente disminuidas,
    pero a partir de este punto mientras más aumenta la duración de la actividad física, las reservas de glucogeno se van
    agotando exponencialmente. 
