
# Eliminar
Eliminar domain/services/objects. Esos objetos solo se usan para hacer pruebas en el código. Igualmente eliminar 
todos los objetos y logs que estén asociados a estos objetos.

# Formulas
Las formulas para TMB son incluso más exactas que las que uso yo, con 3 decimales de exactitud en los valores
de las variables de estas formulas. La diferencia con los resultados de mis formulas es mínica (5 cal). Sin
embargo, sería bueno revisar fuentes confiables que validen esto. Por el momento dejarlo así es más que 
suficiente pues no compromete la validez de los resultados.

# Generación plan
Por el momento, no se está calculando el gasto de cada sesión de entrenamiento Pero está el método 
construirDatosEntrenamiento que construye datos necesarios para cauclar el gasto de cada sesión, como
duración e intensidad.
Esto impide dar recomendaciones deportivas específicas para cada sesión de entrenamiento. Queda pendiente.

# Datasources y repositories
Falta añadir datasources y repositories para los services, y así evitar consumir directamente el orm.

# Cálculo proteina
La doc indica una serie de reglas para definir el cálculo de proteina, condicionado por deporte, periodo,
entre otras variables. En la práctica, se establece 1.6gr/kg como único valor, ya que es el valor que cubre
la mayor cantidad de casos posibles. Los únicos que no cubriría serían periodos de definición en atletas muy
magros, o periodos de definición en fisicoculturistas.

# Cálculo HdeC 
Falta añadir un cálculo que cubra la situación de un atleta los días previos a una competencia, caso en el 
cual se debería entregar un aporte de HdeC mayor a lo normal. Además de otros casos como periodos 
pre competitivos o competitivos. Queda pendiente.

# Convención de nombre
Hay nombres de DTOs, como Comida, que deberían llamarse 'ComidaDto' por un tema de consistencia... 
corregir en algún momento. Ahora no lo hago porque estoy viendo otras cosas.

# Types
Hay valores importantisimos como 'definicion', 'mantencion', 'volumen' que deberían estar definidos como
un Type o algo, ya que al escribir código uno se puede confundir, y en lugar de 'definicion' escribir 
'definir', romiendo el codigo.