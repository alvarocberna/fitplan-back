
# Adecuación de porciones de alimento por tiempo de comida

`src/domain/services/alimentos/porciones-alimentos.ts` define `PORCIONES_GRUPOS_ALIMENTOS`: una tabla de
intercambio de alimentos (cereales, verduras de libre/consumo general, frutas, proteínas alta/baja en
grasa, lácteos por nivel de grasa, ricos en lípidos, aceites/grasas, azúcares), cada uno con su aporte
nutricional por porción y una lista de alimentos de ejemplo con su porción y gramaje.

`consulta.prompts.ts` usa esta tabla (`buildGruposAlimentosInfo`) para decirle a la IA, por cada campo del
objeto `alimentos` de un tiempo de comida, el aporte por porción del grupo correspondiente y alimentos de
ejemplo — así el modelo calcula cuántas porciones de cada grupo corresponden y arma los `ejemplos` con
alimentos reales.

Este paso se encarga de generar los campos 'descripcion', 'aporte' y 'alimentos' pertenecientes del campo 'tiempos_de_comida' 
del objeto PlanNutricionalDto, generado por el método 'procesar' del archivo `generacion-plan.service.ts`

# Pasos para calcular el campo 'alimentos' correspondiente a las porciones de alimentos por tiempo de comida

## 0 - Pre requisitos
    - Tener los requerimientos de energía, proteina, carbohidratos y lípidos ya calculados.

## 1 - Se definen los tiempos de comida (IA y Codigo)
    - Los tiempos de comida definidos por el usuario no necesariamente corresponden a los tiempos de comida que se definirán en el
      plan. Si los tiempos de comida sin insuficientes (1, 2 o 3 tiempos de comida al día) se deben añadir más tiempos, con el 
      fin de distribuir los alimentos de forma balanceada y no sobrecargar ningun tiempo.
    - El número final de tiempos de comida dependerá del objetivo. Si el objetivo es definir o mantener, 4 tiempos. Si el objetivo es 
      volumen, 5 tiempos.
    - Tenemos 2 tipos de tiempos de comida:
      - Tiempos de comida principales: Desayuno, Almuerzo, Once y Cena. En ese orden.
      - Tiempos de comida secundarios: Colación. Van entre dos comidas principales, pudiendo haber 3 colaciones como máximo, 
        aunque ese sería un escenario improbable. Lo normal sería que haya cero, uno o dos colaciones.
    - Para definir los tiempos de comida final, se debe iniciar definiendo los tiempos de comida ingresados por el paciente. 
      Numero y nombre. Por ejemplo, si el paciente indicó Desayuno, Almuerzo y Once, tenemos 3 tiempos, con los nombres recién mencionados.
    - Luego de definir los tiempos iniciales, se deben corregir en caso de ser insuficientes, según lo mencionado con anterioridad, siguiendo
      las siguientes reglas:
    - Reglas para agregar tiempos si tenemos 1, 2 o 3 tiempos de comida:
        - Reglas para completar los 4 tiempos (cuando el objetivo es definir o mantener):
            - La estructura objetivo es 3 tiempos principales y 1 tiempo secundario. Por ejemplo, Desayuno, Almuerzo, Colacion y Once.
            - Respecto a los tiempos principales, se debe completar los tiempos faltantes en orden. Por ejemplo, si hay almuerzo y cena,
            se debe añadir desayuno. Si hay desayuno y once, se debe añadir almuerzo, pues, en la lista de tiempos principales, es el
            primero de la lista que falta.
            - Respecto a los tiempos secundarios, si se dispone de la hora de cada tiempo, se debe añadir 
            la colación entre los dos tiempos que tengan la ventana de tiempo superior. Ejemplo: Desayuno 8am, Almuerzo 1pm,
            Once 8pm. Entre desayuno y almuerzo hay 5 horas, y entre almuerzo y once hay 7 horas. Por lo tanto, en este ejemplo
            la colación se añade entre Almuerzo y Once en una hora media, como 5pm.
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
          añadir otra colación entre dos comidas principales con intervalo de tiempo mayor, siempre y cuando no tengan una colación
          entre ellas previamente.

## 2 - Se eliminan alimentos de los tiempos de comida (IA)
    - Se deben eliminar del objeto 'alimentos' los grupos de alimentos 'no saludables' o que no aportan valor real en 
      cada tiempo de comida, como por ejemplo:
    - Desayuno y Once: azucares (mermelada, membrillo) y aceites (margarina, mantequilla).
    - Almuerzo y Cena: azucares (chocolates, galletas, o postres como helado, flanes, etc)
    - Colacion: azucares (mermelada, membrillo), aceites (margarina, mantequilla)

## 3 - Adecuación de grupos de alimentos (codigo)

### 3.1 - Adecuación de proteina
    - Primero: La función calculoRequerimientos ha establecido el requerimiento de proteina. En base a este requerimiento
      se calcula el requerimientoCorregidoProteina, el cual corresponde al 90% del requerimiento de proteina calculado. La razón
      de esto es que cuando se calculen los otros grupos de alimentos se añadirá más proteina.
      - Ejemplo: Si el requerimiento es 120gr, se calculan 108gr, siendo 108 el requerimientoCorregidoProteina. 
    - Segundo: Calculo de porciones: 
        - Se debe ir añadiendo 1 porción de un alimento rico en proteina, cada vez que se añade una nueva porción
          se calcula la adecuación en base al requerimientoCorregidoProteina, hasta llegar al 100% (108gr en este ejemplo).
        - La lista de alimentos ricos en proteina se basa en los alimentos del objeto PORCIONES_GRUPOS_ALIMENTOS,
          e incluye los siguientes aliementos:
          - Grupo: Proteinas. Subcategoría: baja en grasa. Se le llamará 'proteina' simplemente para simplificar.
          - Grupo: Lácteos. Subcategoría: medios en grasas. Se le llamará 'lacteos' simplemente para simplificar.
          - Grupo: Lácteos. Subcategoría: protein. Se le llamará 'lacteo protein' para distinguir del otro lacteo.
        - Se debe seguir el siguiente orden al momento de añadir porciones: La pimera, segunda y tercera porción
          añadida corresponde al grupo de 'proteina', la cuarta porción corresponde a lácteos . Esto sigue la regla de
          que por cada 3 grupos de proteina debe añadirse un grupo de lacteos.
        - El proceso de añadir grupos de proteinas y lacteos tiene un limite. Si se alcanzan las 2 porciones de proteina
          por tiempo de comida principal (ejemplo: tenemos desayuno, almuerzo y once, y se alcanzaron las 6 porciones de proteina)
          y todavía no se alcanza la adecuación de proteina, se debe dejar de añadir porciones de proteina y lacteos, y
          aplicar las siguientes estrategias:
            - Cambiar lacteos normales por lacteos protein, luego calcular adecuación. Si no se ha logrado el 100% de
              la adecuación de requerimientoCorregidoProteina se continua con lo siguiente:
            - Añadir 1/2 scoop de whey protein. El aporte nutricional de whey protein se encuentra disponble en el grupo
              suplementos. Si no se logra la adecuación, se continua con lo siguiente:
            - Cambia el 1/2 scoop de whey protein por 1 scoop. Si aún no se logra la adecuación, se continua añadiendo 
              grupos de proteina y lacteos.
        - Luego, de haber cambiado el grupo lacteo por lacteo protein, y de haber añadido 1 scoop de whey protein, se debe
          seguir añadiendo porciones de proteina y lácteos siguiendo las reglas mencionadas con anterioridad, hasta alcanzar
          el 100% de acecuación de requerimientoCorregidoProteina.
    - Tercero: Distribuir las porciones calculadas en los tiempos de comida definidos:
        Proteina
        - Las porciones de proteina se deben distribuir equitativamente entre los tiempos de comida principales con un máximo inicial
          de 2 porciones por tiempo principal. Si se distribuyeron 2 porciones por tiempo principal y quedan porciones, se deben añadir
          en la primera colación con un máximo de 2 porciones (aunque hayan 2 colaciones, solo se debe en una colación). Si siguen sobrando
          porciones de proteina, se añaden de una en una en los tiempos de comida principales en orden ascendente.
        - Ejemplo 1: Tenemos 6 porciones de proteina y  4 tiempos de comida: Desayuno, Almuerzo, Colación y Once. 
          La distribución será: Desayuno 2, Almuerzo 2, Colación 0, Once 2.
        - Ejemplo 2: Tenemos 7 porciones de proteina y 4 tiempos de comida: Desayuno, Almuerzo, Colación, Once.
          La distribución será: Desayuno 2, Almuerzo 2, Colación 1, Once 2.
        - Ejemplo 3: Tenemos 8 porciones de proteina y 5 tiempos de comida: Desayuno, Almuerzo, Colación, Once, Cena.
          La distribución será: Desayuno 2, Almuerzo 2, Colación 0, Once 2, Cena 2.
        - Ejemplo 4: Tenemos 9 porciones y 5 tiempos de comida: Desayuno, Colación, Almuerzo, Colación, Cena.
          La distribución será: Desayuno 3, Colacion 2, Almuerzo 2, Colación 0, Cena 2.
        Lácteo
        - Las porciones de lácteos y/o lacteos protein se distribuirán unicamente en los siguientes tiempos de comida: Desayuno, Once, Colaciones.
        - Las porciones de lácteos se deben distribuir de una en una en el siguiente orden: 1° Desayuno, 2° Once, 3° Colación primera,
          4° Colación segunda.
        - En caso de que haya un número de porciones de lácteos superior al número de tiempos de comida que llevan lácteos, se
          debe añadir un segundo lácteo siguiendo el orden definido.
        - Sin embargo, si una colación contiene 1 porción de cereales, entonces pasa a ser primera priodiad. Esto se aplica SOLO
          si contiene 1 porción de cereales. Si contiene 2 entonces ya no aplica.
        - Ejemplo 1: Tenemos 2 porciones de lácteos y los siguientes tiempos de comida: Desayuno, Almuerzo, Colación sin cereales, Once.
          La distribución será: Desayuno 1, Almuerzo 0, Colacion 0, Once 1.
        - Ejemplo 2: Tenemos 2 porciones de lácteos y los siguientes tiempos de comida: Desayuno, Almuerzo, Colación con 1 porción de cereales, Once.
          La distribución será: Desayuno 1, Almuerzo 0, Colación 1, Once 0.
        - Ejemplo 3: Tenemos 3 porciones de lácteos y los siguientes tiempos de comida: Desayuno, Colacion, Almuerzo, Colacion, Once.
          La distribución será: Desayuno 1, Colacion 1, Almuerzo 0, Colacion 0, Once 1.
        - Ejemplo 4: Tenemos 3 lacteos y los siguientes tiempos de comida: Desayuno, Almuerzo, Once, Cena.
          La distribución será: Desayuno 2, Almuerzo 0, Once 1, Cena 0.

### 3.2 - Adecuación de carbohidratos 
    - Primero: Se debe tomar el requerimiento de carbohidrato calculado por la funcion calculoRequerimientos, y restar el aporte de
      carbohidratos de los grupos de proteina y lacteos calculados en el paso anterior. El valor resultante corresponde a
      requerimientoCorregidoCarbohidrato.
    - Ejemplo: Si el requerimiento es 300gr, pero las proteinas, lacteos y lacteos protein aportan 20gr de carbohidratos, entonces el
      valor de requerimientoCorregidoCarbohidrato es 280gr.
    - Segundo: Calculo de porciones: 
        - Se debe ir añadiendo 1 porción de un alimento ricos en carbohidratos
          y calcular su adecuación, hasta llegar al 100% de adecuación de requerimientoCorregidoCarbohidrato.
        - Los grupos de alimentos ricos en carbohidratos son: Cereales, verduras, frutas.
        - Se debe seguir el siguiente orden al momento de añadir porciones: 
            - 1° Se deben añadir 2 porciones de verduras de libre consumo en los tiempos que sean Almuerzo y Cena.
              Los otros tiempos (desayuno, once, colacion) jamás llevan verduras.
            - 2° Se deben ir sumando porciones de cereales de uno en uno, por cada porción añadida se debe calcular la adecuación.
            - 3° Por cada 3 porciones de cereales se debe añadir 1 porción de fruta.
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
          La distribución será: Desayuno 2, Almuerzo 2, Colacion 0, Once 1.
        - Ejemplo 2: Tenemos 6 porciones de cereales y 4 tiempos de comida: Desayuno, Almuerzo, Colación y Once. 
          La distribución será: Desayuno 2, Almuerzo 2, Colacion 0, Once 2.
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
    - Primero: Se debe tomar el requerimiento de lipidos calculado por la funcion calculoRequerimientos, y restar el aporte de
      lipidos de los grupos de proteina, lacteos, cereales, fruta y verduras calculados en los pasos anteriores. El valor resultante 
      corresponde a requerimientoCorregidoLipidos.
    - Ejemplo: Si el requerimiento es 80gr, pero entre todos los otros grupos hay un aporte de 30gr, el valor de 
      requerimientoCorregidoLipidos es de 50gr.
    - Segundo: Calculo de porciones: 
        - Se debe ir añadiendo 1 porción de un alimento que aporte lípidos
          y calcular su adecuación, hasta llegar al 100% de adecuación de requerimientoCorregidoLipidos.
        - Los grupos de alimentos que aportan lípidos son: ricos en lipidos y aceites y grasas, disponible
          en PORCIONES_GRUPOS_ALIMENTOS.
        - Se debe seguir el siguiente orden al momento de añadir porciones: 
            - 1° 1 porción de ricos en lipidos.
            - 2° 1/2 porción de aceites.
            - Por cada porción de rico en lipidos se debe añadir 1/2 porción de aceite.
            - Cada vez que se añade una porción (o media porción en este caso) se debe calcular la adecuación
              para determinar si se continúa añadiendo o se detiene.
    - Tercero: Distribuir las porciones calculadas en los tiempos de comida:
        Ricos en lipidos:
        - Deben distribuirse en los siguientes tiempos de comida: Desayuno, Colaciones, Once, siguiendo ese orden.
        - Ejemplo 1: Tenemos 2 porción de ricos en lipidos y los tiempos de comida: Desayuno, Almuerzo, Colacion, Once.
          La distribución será: Desayuno 1, Almuerzo 0, Colacion 1, Once 0.
        - Ejemplo 2: Tenemos 3 porción de ricos en lipidos y los tiempos de comida: Desayuno, Colacion, Almuerzo, Colacion, Once.
          La distribución será: Desayuno 1, Colacion 1, Almuerzo 0, Colacion 1, Once 0.
        Aceites:
        - Deben distribuirse en los siguientes tiempos de comida: Almuerzo, Cena.
        - Se debe distribuir el total de porciones de aceite entre los tiempos de comida existentes que lleven lipidos.
        - Ejemplo 1: Tenemos 1 porción de aceite y los tiempos de comida: Desayuno, Almuerzo, Colacion, Cena.
          La distribución será: Almuerzo 1/2 porción de aceites. Cena 1/2 porción de aceites.
       - Ejemplo 2: Tenemos 1 porción de aceite y los tiempos de comida: Desayuno, Almuerzo, Colacion, Once.
          La distribución será: Almuerzo 1 porción de aceites.

## 4 - Todas las porciones han sido calculadas y distribuidas. Ahora se debe calcular la adecuación nuevamente (codigo)
    - La adecuación total debe estar en el rango de 95-105%, al igual que la adecuación de cada macronutriente.
    - Si la adecuación es mayor o menor, se deben reajustar las porciones de los tiempos de comida. Aún no se define el como,
      por lo que solo se debe calcular la adecuación, y deja tal cual esté, aunque no cumpla la regla de 95-105%.

# Pasos para generar el campo 'aporte' (codigo)
  - Se debe sumar la energía, proteina, carbohidratos y lipidos de cada grupo de alimento o simplemente 'alimento'
    de cada tiempo de comida, en base a los valores de 'aporte_por_porcion' establecidos en `PORCIONES_GRUPOS_ALIMENTOS` 
    definido en el archivo `src/domain/services/alimentos/porciones-alimentos.ts`.

# Como determinar el campo 'descripcion' (IA)
  - Este paso se ejecuta después de los ya mencionados, pues es necesario reajustar los tiempos de comida existentes,
    pues, de ser insuficientes se deben agregar nuevos.
  - El campo descripción contiene dos campos, llamados 'tiempo' y 'hora'.
  - Tiempo (tiempo de comida): Puede ser desayuno, colación am, almuerzo, colación pm, once o cena. Es 
    determinado por la IA en base a la información entregada por el usuario en el objeto ConsultaCompleta.
  - Hora: Representa la hora del tiempo, pudiendo ser cualquier hora del relor como 10am, 8pm, etc. Es 
    determinado por la IA en base a la información entregada por el usuario en el objeto ConsultaCompleta.