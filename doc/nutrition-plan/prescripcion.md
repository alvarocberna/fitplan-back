
# Prescripcion

Prescripcion corresponde a la información del campo 'prescripcion' del objeto PlanNutricionalDto
generado por el método 'procesar' del archivo `generacion-plan.service.ts`

El campo 'prescripcion' tiene la siguiente estructura:

``` 
"prescripcion": {
    "regimen": string,
    "objetivo": string,
    "calorias": number,
    "proteina": number,
    "carbohidrato": number,
    "lipido": number
  }
```

## Regimen
    - Sigue la siguiente estructura: Regimen + 'prescripcion calorica' + 'prescripcion proteica'.
    - Este campo debe ser generado por IA siguiendo las indicaciones mencionadas a continuación.
    - Prescripcion calorica (valores): hipocalórico, hipercalórico, hipercalórico.
        - hipocalorico: se da cuando el objetivo es 'definicion' y se ha aplicado un deficit energético al gasto energético
          total (GET).
        - normocalorico: se da cuando el objetivo no es 'definicion' ni tampoco 'volumen'. no conlleva un cambio
          en el aporte energético total (GET).
        - hipercalorico: se da cuando el objetivo es 'volumen' y se ha aplicado un superavit energético al gasto
          energetico total (GET).
    - Prescripcion proteica (valores): hipoproteico, normoproteico, hiperproteico.
        - hipoproteico: cuando el aporte de proteina es bajo 0.8 gr/kg. en la práctica NUNCA se va a prescribir.
        - normoproteico: cuando el aporte de proteina es entre 0.8 y bajo 1.2 gr/kg. en la práctica NUNCA se va a prescribir
          ya que el sistema está configurado para siempre entregar 1.6gr por kg de peso.
        - hiperproteico: cuando el aporte de proteina es 1.2gr/kg o más. este es el valor que se debe indicar siempre acorde
          a la configuración actual del sistema que prescribe 1.6 gr/kg en todos los casos. hay casos en que se entregará 
          un aporte de proteina en base al peso corregido, por lo que puede que el aporte final de proteina sea bajo 1.2gr 
          por kg de peso, pero aún en estos casos el aporte sigue siendo hiperproteico.
    - Ejemplos:
        - Ejemplo 1: Régimen normocalóico hiperproteico.
        - Ejemplo 2: Régimen hipocalórico hiperproteico.
        - Ejemplo 3: Régimen hipercalórico hiperproteico.

# Objetivo
    - El objetivo es obtenido del campo 'objetivos' del objeto AnamnesisDto perteneciente a ConsultaCompletaDto.
    - El campo 'objetivo' debe generarse mediante IA en base a los campos objetivo_principal y objetivo_secundario.
    - Ejemplos:
        - Ejemplo 1: Disminuir porcentaje de grasa corporal y mantener masa muscular.
        - Ejemplo 2: Aumentar masa muscular.
        - Ejemplo 3: Mejorar rendimiento deportivo.
        - Ejemplo 4: Mejorar rendimiento deportivo y ganar masa muscular y fuerza.
        - Ejemplo 5: Aumentar masa muscular y disminuir porcentaje de grasa corporal.

# Macronutrientes
    - Los otros campos de 'prescripcion' son: calorias, proteina, carbohidratos, lipidos. Estos campos son calculados
      mediante formulas en el archivo `requerimientos.service.ts`.
    - Son valores fijos, no calculados por IA.
