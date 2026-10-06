
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