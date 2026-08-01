
# Descripcion

En este paso se definen los campos 'suplementos' y 'recomendaciones_deportivas' pertenecientes al objeto PlanNutricionalDro

# Adecuación de porciones de alimento por tiempo de comida

`src/domain/services/alimentos/porciones-alimentos.ts` define `PORCIONES_GRUPOS_ALIMENTOS`: una tabla de
intercambio de alimentos (cereales, verduras de libre/consumo general, frutas, proteínas alta/baja en
grasa, lácteos por nivel de grasa, ricos en lípidos, aceites/grasas, azúcares), cada uno con su aporte
nutricional por porción y una lista de alimentos de ejemplo con su porción y gramaje.

`consulta.prompts.ts` usa esta tabla (`buildGruposAlimentosInfo`) para decirle a la IA, por cada campo del
objeto `alimentos` de un tiempo de comida, el aporte por porción del grupo correspondiente y alimentos de
ejemplo — así el modelo calcula cuántas porciones de cada grupo corresponden y arma los `ejemplos` con
alimentos reales.

Este paso se encarga de generar los campos 'aporte' y 'alimentos' pertenecientes al campo 'tiempos_de_comida' del objeto PlanNutricionalDto
generado por el método 'procesar' del archivo `generacion-plan.service.ts`

# Pasos para calcular el campo 'alimentos' correspondiente a las porciones de alimentos por tiempo de comida

## 0 - Pre requisitos
    - Tener los requerimientos de energía, proteina, carbohidratos y lípidos ya calculados.

## 1 - Se definen los tiempos de comida (IA)
    - Se debe definir los tiempos de comida ingresados por el paciente. Numero y nombre. Por ejemplo, si
      el paciente indicó Desayuno, Almuerzo y Once, tenemos 3 tiempos, con los nombres recién mencionados.
    - Tiempos de comida principales: Desayuno, Almuerzo, Once y Cena. En ese orden.
    - Tiempos de comida secundarios: Colaciones. Van entre dos comidas principales, pudiendo haber 3 máximo, aunque ese sería un
      escenario improbable. Lo normal sería que haya cero, uno o dos colaciones.
    - El número final de tiempos de comida dependerá del objetivo. Si el objetivo es definir o mantener, 4 tiempos. Si el objetivo es 
      volumen, 5 tiempos.
    - Reglas para agregar tiempos si tenemos 1, 2 o 3 tiempos de comida:
        - Reglas para completar los 4 tiempos:
            - La estructura objetivo es 3 tiempos principales y 1 tiempo secundario. Por ejemplo, Desayuno, Almuerzo, Colacion y Once.
            - Respecto a los tiempos principales, se debe completar los tiempos faltantes en orden. Por ejemplo, si hay almuerzo y cena,
            se debe añadir desayuno. Si hay desayuno y once, se debe añadir almuerzo, pues, en la lista de tiempos principales, es el
            primero de la lista que falta.
            - Respecto a los tiempos secundarios, si se dispone de la hora de cada tiempo, se debe añadir 
            la colación entre los dos tiempos que tengan la ventana de tiempo superior. Ejemplo: Desayuno 8am, Almuerzo 1pm,
            Once 8pm. Entre desayuno y almuerzo hay 5 horas, y entre almuerzo y once hay 7 horas. La colación se añade entre
            Almuerzo y Once en una hora media, como 5pm.
        - Reglas para completar los 5 tiempos:
            - La estructura objetivo es 3 tiempos principales y 2 tiempo secundario. Por ejemplo, Desayuno, Colacion, Almuerzo, Colacion y Once.
            - Respecto a los tiempos principales, se debe completar los tiempos faltantes en orden. Por ejemplo, si hay almuerzo y cena,
            se debe añadir desayuno. Si hay desayuno y once, se debe añadir almuerzo, pues, en la lista de tiempos principales, es el
            primero de la lista que falta.
            - Respecto a los tiempos secundarios, si se dispone de la hora de cada tiempo, se debe añadir 
            una colación en entre el primer y segundo tiempo principal, y otra entre el segundo y tercer tiempo principal.
    - Reglas para agregar tiempos si tenemos 4 tiempos de comida.
        - En este escenario, solo agregaríamos un tiempo más si es que el objetivo es el de volumen.
        - Si las 4 comidas existentes son las principales (desayuno, almuerzo, once, cena), se debe añadir una colación
          entre las dos comidas que tengan el intervalo de tiempo mayor.
        - Si de las 4 comidas existentes, solo hay 3 principales y una secundaria (desayuno, colacion, almuerzo, cena), se debe
          añadir otra colación entre dos comidas principales que no tengan ya una colación entre medio.

## 2 - Se eliminan alimentos de los tiempos de comida (IA)
    - Se deben eliminar los grupos de alimentos 'no saludables' o que no aportan valor real en cada tiempo de comida, 
      como por ejemplo:
    - Desayuno y Once: azucares (mermelada, membrillo) y aceites (margarina, mantequilla).
    - Almuerzo y Cena: azucares (chocolates, galletas, o postres como helado, flanes, etc)
    - Colacion: azucares (mermelada, membrillo), aceites (margarina, mantequilla)

## 3 - Adecuación de grupos de alimentos 

### 3.1 - Adecuación de proteina
    - Primero: Se calculan los gr de proteina para llegar aun 90% de acecuación. 
    - Ejemplo: Si el requerimiento es 120gr, se calculan 108gr. 
    - Segundo: Calculo de porciones: 
        - Se debe ir añadiendo 1 porción de un alimento rico en proteina
          y calcular su adecuación, hasta llegar al 100% del 90% de la adecuación (108gr en este ejemplo).
        - Se debe seguir el siguiente orden al momento de añadir porciones: La pimera, segunda y tercera porción
          añadida corresponde al grupo de proteina, la cuarta porción corresponde a lácteos. Esto sigue una regla,
          y es que por cada 3 grupos de proteina debe añadirse un grupo de lacteos.
        - El proceso de añadir grupos de proteinas y lacteos tiene un limite. Si se alcanzan las 2 porciones de proteina
          por tiempo de comida principal (ejemplo: tenemos desayuno, almuerzo y once, y se alcanzaron las 6 porciones de proteina)
          y todavía no se alcanza la adecuación de proteina, se debe dejar de añadir porciones de proteina y lacteos, y
          aplicar las siguientes estrategias:
            - Cambiar lacteos normales por lacteo protein, luego calcular adecuación. Si no se ha logrado la meta, se continua con lo siguiente:
            - Añade 1/2 scoop de whey protein. Si no se logra la adecuación, se continua con lo siguiente:
            - Cambia el 1/2 scoop de whey protein por 1 scoop. Si aún no se logra la adecuación, ahora si continuamos añadiendo grupos de proteina
              y lacteos.
        - Ahora si seguimos añadiendo porciones de proteina y lacteos, hasta lograr la adecuación del 100% del 90%.
    - Tercero: Distribuir las porciones calculadas en los tiempos de comida:
        Proteina
        - Las porciones de proteina se deben distribuir equitativamente entre los tiempos de comida principales con un máximo inicial
          de 2 porciones por tiempo principal. Si se distribuyeron 2 porciones por tiempo principal y quedan porciones, se deben añadir
          en la primera colación con un máximo de 2 porciones (aunque hayan 2 colaciones, solo se debe en una colación). Si siguen sobrando
          porciones de proteina, se añaden de una en una en los tiempos de comida principales en orden ascendente.
        - Ejemplo 1: Tenemos 6 porciones de proteina y  4 tiempos de comida: Desayuno, Almuerzo, Colación y Once. 
          La distribución será: Desayuno 2, Almuerzo 2, Once 2.
        - Ejemplo 2: Tenemos 7 porciones de proteina y 4 tiempos de comida: Desayuno, Almuerzo, Colación, Once.
          La distribución será: Desayuno 2, Almuerzo 2, Colación 1, Once 2.
        - Ejemplo 3: Tenemos 8 porciones de proteina y 5 tiempos de comida: Desayuno, Almuerzo, Colación, Once, Cena.
          La distribución será: Desayuno 2, Almuerzo 2, Once 2, Cena 2.
        - Ejemplo 4: Tenemos 9 porciones y 5 tiempos de comida: Desayuno, Colación, Almuerzo, Colación, Cena.
          La distribución será: Desayuno 3, Colacion 2, Almuerzo 2, Cena 2.
        Lácteo
        - Las porciones de lácteos se distribuirán unicamente en los siguientes tiempos de comida: Desayuno, Once, Colacion.
        - Las porciones de lácteos se deben distribuir de una en una en el siguiente orden: 1° Desayuno, 2° Once, 3° Colación primera,
          4° Colación segunda.
        - En caso de que haya un número de porciones de lácteos superior al número de tiempos de comida que llevan lácteos, se
          debe añadir un segundo lácteo siguiendo el orden definido.
        - Sin embargo, si una colación contiene 1 porción de cereales, entonces pasa a ser primera priodiad. Esto se aplica SOLO
          si contiene 1 porción de cereales. Si contiene 2 entonces ya no aplica.
        - Ejemplo 1: Tenemos 2 porciones de lácteos y los siguientes tiempos de comida: Desayuno, Almuerzo, Colación sin cereales, Once.
          La distribución será: Desayuno 1, Once 1.
        - Ejemplo 2: Tenemos 2 porciones de lácteos y los siguientes tiempos de comida: Desayuno, Almuerzo, Colación con 1 porción de cereales, Once.
          La distribución será: Desayuno 1, Colación 1.
        - Ejemplo 3: Tenemos 3 porciones de lácteos y los siguientes tiempos de comida: Desayuno, Colacion, Almuerzo, Colacion, Once.
          La distribución será: Desayuno 1, Colacion 1, Once 1.
        - Ejemplo 4: Tenemos 3 lacteos y los siguientes tiempos de comida: Desayuno, Almuerzo, Once, Cena.
          La distribución será: Desayuno 2, Once 1.

### 3.2 - Adecuación de carbohidratos
    - Primero: Se calculan los gr de carbohidratos para llegar aun 100% de acecuación, considerando los gr de carbohidratos que
      ya aportan los grupos de las proteinas y lacteos.
    - Ejemplo: Si el requerimiento es 300, pero las proteinas y lacteos aportan 20gr de carbohidratos, entonces los gr de carbohidratos
      que debemos cubrir son 280gr.
    - Segundo: Calculo de porciones: 
        - Se debe ir añadiendo 1 porción de un alimento ricos en carbohidratos
          y calcular su adecuación, hasta llegar al 100% de la adecuación (280 en este ejemplo).
        - Los grupos de alimentos ricos en carbohidratos son: Cereales, verduras, frutas.
        - Se debe seguir el siguiente orden al momento de añadir porciones: 
            - 1° Se deben añadir 2 porciones de verduras de libre consumo en los tiempos que sean Almuerzo y Cena.
              Los otros tiempos (desayuno, once, colacion) jamás llevan verduras.
            - 2° Se deben ir sumando porciones de cereales de uno en uno, por cada porción añadida se debe calcular la adecuación.
            - 3° Por cada 3 porciones de cereales se debe sumar 1 porción de fruta.
    - Tercero: Distribuir las porciones calculadas en los tiempos de comida:
        Verduras:
        - Siempre los tiempos de Almuerzo y Cena deben llevar 2 porciones de verduras.
        Cereales:
        - Las porciones de cereales se deben distribuir equitativamente entre los tiempos de comida principales con un máximo inicial
          de 2 porciones por tiempo principal. Si se distribuyeron 2 porciones por tiempo principal y quedan porciones, se deben añadir
          en las colaciones con un máximo inicial de 1 porcion por colación. Si siguen sobrando porciones de cereales, se deben añadir
          nuevamente a las colaciones, esta vez con un máximo de 2. Si siguien sobrando porciones de cereales, se deben añadir a los
          tiempos de comida principales sumando de uno en uno siguiendo el orden estandar Desayuno -> Almuerzo -> Once -> Cena.
          porciones de proteina, se añaden de una en una en los tiempos de comida principales en orden ascendente.
        - Ejemplo 1: Tenemos 5 porciones de cereales y 4 tiempos de comida: Desayuno, Almuerzo, Colación y Once. 
          La distribución será: Desayuno 2, Almuerzo 2, Once 1.
        - Ejemplo 2: Tenemos 6 porciones de cereales y 4 tiempos de comida: Desayuno, Almuerzo, Colación y Once. 
          La distribución será: Desayuno 2, Almuerzo 2, Once 2.
        - Ejemplo 3: Tenemos 7 porciones de cereales y 5 tiempos de comida: Desayuno, Colación, Almuerzo, Colación, Once.
          La distribución será: Desayuno 2, Colación 1, Almuerzo 2, Colación 0, Once 2.
        - Ejemplo 4: Tenemos 8 porciones de cereales y 5 tiempos de comida: Desayuno, Colación, Almuerzo, Colación, Once.
          La distribución será: Desayuno 2, Colación 1, Almuerzo 2, Colación 1, Once 2.
        - Ejemplo 5: Tenemos 9 porciones de cereales y 5 tiempos de comida: Desayuno, Colación, Almuerzo, Colación, Once.
          La distribución será: Desayuno 2, Colación 2, Almuerzo 2, Colación 1, Once 2.
        - Ejemplo 6: Tenemos 11 porciones de cereales y 5 tiempos de comida: Desayuno, Colación, Almuerzo, Colación, Once.
          La distribución será: Desayuno 3, Colación 2, Almuerzo 2, Colación 2, Once 2.
        Fruta
        - Las porciones de fruta se distribuirá en el siguiente orden: 1° colaciones, 2° almuerzo, 3° desayuno, 4° once, 5° cena.
        - Si las porciones de frutas son mayores a los tiempos de comida, se debe añadir otra porción (2 porciones en total) a
          los tiempos siguiendo el mismo orden indicado.

### 3.3 - Adecuación de lipidos
    - Primero: Se calculan los gr de lípidos para llegar aun 100% de acecuación, considerando los gr de lípidos que
      ya aportan los otros grupos ya calculados anteriormente.
    - Ejemplo: Si el requerimiento es 80gr, pero entre todos los otros grupos hay un aporte de 30gr, entonces los gr de lípidos
      que debemos cubrir son 50gr.
    - Segundo: Calculo de porciones: 
        - Se debe ir añadiendo 1 porción de un alimento que aporte lípidos
          y calcular su adecuación, hasta llegar al 100% de la adecuación (50gr en este ejemplo).
        - Los grupos de alimentos que aportan lípidos son: ricos en lipidos y aceites.
        - Se debe seguir el siguiente orden al momento de añadir porciones: 
            - 1° 1 porción de ricos en lipidos.
            - 2° 1/2 porción de aceites.
            - Por cada porción de rico en lipidos se debe añadir 1/2 porción de aceite.
            - Cada vez que se añade una porción (o media porción en este caso) se debe calcular la adecuación
              para determinar si se continúa añadiendo o se detiene.
    - Tercero: Distribuir las porciones calculadas en los tiempos de comida:
        Ricos en lipidos:
        - Deben distribuirse en los siguientes tiempos de comida: Desayuno, Colacion, Once, siguiendo ese orden.
        - Ejemplo 1: Tenemos 2 porción de ricos en lipidos y los tiempos de comida: Desayuno, Almuerzo, Colacion, Once.
          La distribución será: Desayuno 1, Colacion 1.
        - Ejemplo 1: Tenemos 3 porción de ricos en lipidos y los tiempos de comida: Desayuno, Colacion, Almuerzo, Colacion, Once.
          La distribución será: Desayuno 1, Colacion 1, Colacion 1.
        Aceites:
        - Deben distribuirse en los siguientes tiempos de comida: Almuerzo, Cena.
        - Se debe distribuir el total de porciones de aceite entre los tiempos de comida existentes que lleven lipidos.
        - Ejemplo 1: Tenemos 1 porción de aceite y los tiempos de comida: Desayuno, Almuerzo, Colacion, Cena.
          La distribución será: Almuerzo 1/2 porción de aceites. Cena 1/2 porción de aceites.
       - Ejemplo 2: Tenemos 1 porción de aceite y los tiempos de comida: Desayuno, Almuerzo, Colacion, Once.
          La distribución será: Almuerzo 1 porción de aceites.

## 4 - Todos las porciones han sido calculadas y distribuidas. Ahora se debe calcular la adecuación nuevamente.
    - La adecuación total debe estar en el rango de 95-105%, al igual que la adecuación de cada macronutriente.
    - Si la adecuación es mayor o menor, se debe reajustar la adecuación...

# Pasos para generar el campo 'aporte'
  - Se debe sumar la energía, proteina, carbohidratos y lipidos de cada tiempo de comida, en base a los valores
    establecidos en `PORCIONES_GRUPOS_ALIMENTOS` definido en el archivo `src/domain/services/alimentos/porciones-alimentos.ts`.
