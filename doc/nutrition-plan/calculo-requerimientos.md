
# Fórmulas de requerimientos energéticos

`src/domain/services/formulas/requirements/requirements.service.ts`:

## tasaMetabolicaBasal (TMB) 
  **Menores de edad con corte en 10 años**
  - FAO/OMS/UNU (1985) separado por sexo.

  **Adulto no deportista (deporte como hobby u ocasional)**
  - adulto normopeso: Carrasco.
  - adulto sobrepeso: Carrasco.
  - adulto obesidad 1-3: Carrasco.

  **Adulto deportista**
  - adulto normopeso: Mifflin.
  - adulto sobrepeso endomorgo: Carrasco.
  - adulto sobrepeso meso-endomorfo. Promedio Carrasco y Mifflin.
  - adulto sobrepeso mesomorfo: Mifflin.
  - adulto obesidad endomorgo: Carrasco.
  - adulto obesidad meso-endomorfo. Promedio Carrasco y Mifflin.
  - adulto obesidad mesomorfo: Mifflin.

  **Criterio**
  - Se consideraron varias formulas para estimar la TMB, como Carrasco, Mifflin, Harris-Benedict.
  - Se eligió Carrasco para adultos no deportistas, ya que en normopeso los valores son muy similares a
    las otras formulas como Mifflin o HB. Esto la ubica en un rango medio, funcionando como buen punto de
    partida si se quiere prescribir un régimen de definición o de volumen. Además, en SP y OB, los valores
    de la TMB son inferiores a las otras formulas, lo cual beneficia si el objetido es definir o mantener, ya
    que evita sobreestimar energía en personas cuyo objetivo más usual será el de perder peso.
  - Se eligió Mifflin para adultos deportistas normopeso, así como SP y OB mesomorfos, ya que no considera este
    exceso de peso como masa grasa a adiferencia de Carrasco.
  - Se eligió promedio entre Mifflin y Carrasco para SP y OB meso-endomorfos, ya que si bien son personas de gran 
    tamaño o volumen, aún así hay que evitar sobreestimar su TMB. Gran parte de su volumen es tejido adiposo.
  - Se eligió Mifflin para SP y OB endomorfos: Si bien es raro que se de esta clasificación, debido a que un deportista
    dificilmente puede solo endomorfo, igualmente se busca evitar sobreestimar TMB.


## gastoEnergeticoTotal (GET)
  - TMB * (1 + (nivel_actividad_fisica - 1) + (CONSTANTE_TERMOGENESIS - 1))
  - CONSTANTE_TERMOGENESIS = 1.1

  
## calculoRequerimientos
  - `energia`: GET (se aplica deficit o superavit según objetivos).
  - `proteina`: `peso * 1.5` g.
  - `carbohidrato`: 50% de la energía (definición) o 55% (volumen/mantención), convertido a gramos (÷4).
  - `lipido`: el resto de la energía tras descontar proteína y carbohidrato, convertido a gramos (÷9).

  **Criterio deficit**
  - Se aplica un déficit energético al GET si el objetivo es disminuir peso o grasa corporal.
  - Se aplica un déficit de -500 kcal para NP y SP.
  - Se aplica un déficit de -750 kcal para OB 1.
  - Se aplica un déficit de -1000 kcal para OB 2 y 3.

  **Criterio superavit**
  - Se aplica un superavit energético al GET si el objetivo es aumentar masa muscular (volumen).
  - En atletas con muy alta masa muscular, se estima una ganancia de un 0.5% de su peso al mes.
  - En atletas con masa muscular alta, se estima una ganancia de un 1% de su peso al mes.
  - En atletas con masa muscular normal o baja, se estima una ganancia de un 1.5% de peso al mes.
  - Para traducir este porcentaje de aumento esperado, se obtiene el peso que se espera ganar por mes
    (ej: 1% de 70kg es 0.7kg), y considerando que para ganar 1KG de masa corporal se requiere ingerir 7000 kcal,
    se calculan las kcal a consumir utilizando regla de tres. El resultado se distribuye en el mes (se divide en 30)
    y se suma a el GET. El valor resultante oscila entre las 100 y 300 calorías.

  **Criterio proteina**
  - Persona físicamente activa (ejercicio recreacional):
    - Aporte: 1.2–1.4 g/kg/día | se establece 1.4
    - Calculo en base a: Peso corporal total
    - Detalle: Personas que entrenan por salud o hobby (2–4 veces/semana)
    - Fuente: ISSN Position Stand (Jäger et al., 2017) 
  - Ganancia de masa muscular
    - Aporte: 1.6–2.2 g/kg/día | se establecer 1.6
    - Calculo en base a: Peso corporal total
    - Detalle: Personas que realizan entrenamiento de fuerza (recreacionales o atletas)
    - Fuente: Morton et al. (2018); ISSN Position Stand (Jäger et al., 2017) 
  - Definición (déficit calórico moderado)
    - Aporte: 1.6–2.0 g/kg/día | se establece 1.6
    - Calculo en base a: Peso corporal total
    - Detalle: Personas que entrenan fuerza por hobby y buscan perder grasa preservando masa muscular
    - Fuente: Morton et al. (2018); Helms et al. (2014); Murphy & Koehler (2021)
  - Definición (déficit importante, atleta muy magro)
    - Aporte: 2.0–2.4 g/kg/día | se establece 2.0
    - Calculo en base a: Peso corporal total
    - Detalle: Atletas entrenados con bajo porcentaje de grasa y déficit energético considerable
    - Fuente: Murphy & Koehler (2021)
  - Definición competitiva (fisicoculturismo o deportes con categorías de peso)
    - Aporte: 2.3–3.1 g/kg/día | se establece 2.3
    - Calculo en base a: Masa libre de grasa (FFM) 
    - Detalle: Atletas de alto rendimiento en preparación para competencia
    - Fuente: Helms et al. (2014); ISSN Position Stand (Jäger et al., 2017)
  - Deportes de resistencia (maratón, ciclismo, triatlón)
    - Aporte: 1.2–1.6 g/kg/día | se establece 1.6
    - Calculo en base a: Peso corporal total 
    - Detalle: Atletas y deportistas de resistencia
    - Fuente: ISSN Position Stand (Jäger et al., 2017); ACSM/AND/DC Position Stand (Thomas et al., 2016) 
  - Deportes de fuerza y potencia (halterofilia, sprint, lanzamientos)
    - Aporte: 1.6–2.0 g/kg/día | se establece 1.6
    - Calculo en base a: Peso corporal total
    - Detalle: Atletas de fuerza y potencia
    - Fuente: ISSN Position Stand (Jäger et al., 2017)
  - Deportes colectivos (fútbol, rugby, hockey, básquetbol)
    - Aporte: 1.4–1.7 g/kg/día | se establece 1.6
    - Calculo en base a: Peso corporal total
    - Detalle: Atletas de deportes intermitentes
    - Fuente: ISSN Position Stand (Jäger et al., 2017)
  - **Reajuste**
    - En personas NP se utilizará el peso total para estimar el requerimiento de proteina.
    - En personas SP y OB se realizará un reajuste del cálculo para evitar sobreestimar requerimientos, dependiendo de si el usuario es:
      - Mesomorfo: se mantiene el peso real como base del cálculo.
      - Meso-Endomorfo: se realiza el cálculo en base a peso reajustado en base a IMC 25.
      - Endomorfo: se realiza cálculo en base a peso reajustado en base a IMC 22.5
    
  **Criterio carbohidrato**
  - Deficit:
    - Se debe entregar por defecto 55% de HdeC, siempre y cuando el aporte de lipidos sea 25% o más. En caso
      contrario, se debe disminuir el aporte de HdeC hasta que los lipidos lleguen a 25%, o hasta que los HdeC lleguen a 50%
    - El aporte de HdeC nunca puede ser menor a 50%.
    - El aporte de HdeC nunca puede ser menor a 3gr/kg de peso.
  - Mantención:
    - Se entrega por defecto un 50% de HdeC.
  - Volumen:
    - Se entrega por defecto un 50% de HdeC. 
    - El aporte de HdeC no debe superar los 5gr/kg de peso.
  
  **Criterio lipidos**
  - El aporte de lípidos es el porcentaje resultante luego de calcular el aporte de proteina e HdeC.
  - El aporte de lípidos idealmente no debe ser menor a 25%, aunque si el % de HdeC es muy bajo, se 
    tendrá que sacrificar los lípidos para aumentar el nivel de HdeC.

## Glosario
- ISSN: International Society of Sports Nutrition.
