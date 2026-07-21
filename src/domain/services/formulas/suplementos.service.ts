
export interface SupplementPrescription {
    supplement: string,
    requirement: number,
    dosageIndication: string,
    intakeIndication: string,
    effects: string[],
    considerations: string[],
}

export interface SupplementsPrescription {
    creatina: SupplementPrescription,
    cafeina: SupplementPrescription,
    nitrato: SupplementPrescription,
    bicarbonato: SupplementPrescription,
}

function creatinaPrescription(peso: number){
    let requirement = Math.ceil(peso * 0.03 * 2) / 2;
    let dosageIndication = `${requirement} gr/día de creatina monohidratada.`
    let intakeIndication = `Mezclar creatina con un liquido (agua) o un alimento (yogurt) y consumir acompañada de alimentos ricos en
    carbohidratos y proteina (como tostadas con huevo) para optimizar su absorción.`;
    let effects = [
        `La suplementación con creatina ayuda a aumentar el rendimiento y la recuperación en deportes o situaciones de alta intensidad, como
        sprints (100m & 200m), esfuerzos repetitivos de alta intensidad (deportes de equipo o tenis) o el sprint final de una carrera de resistencia. `
    ]
    let considerations = [
        'Considerar que puede haber un posible aumento de 1-2kg de peso corporal causada por la retención de liquido intracelular a nivel muscular.',
    ];
    let prescription = {
        supplement: 'Creatina',
        requirement: requirement,
        dosageIndication: dosageIndication,
        intakeIndication: intakeIndication,
        effects: effects,
        considerations: considerations,
    }
    return prescription;
}

function cafeinaPrescription(peso: number){
    let requirement = Math.ceil(peso * 1.5 / 5) * 5;
    let dosageIndication = `${requirement} mg pre ejercicio.`
    let intakeIndication = `Consumir capsula, gel o café con el aporte recomendado previo a la sesión de ejercicio.`;
    let effects = [
        `La suplementación con cafeina activa el sistema nervioso, reduce la percepción de esfuerzo y la sensación de dolor, además de mejorar el rendimiento. Se recomienda su uso en deportes que combinan resistencia y alta intensidad.`
    ];
    let considerations = [
        `Consumir solo la dosis indicada. El consumo excesivo de cafeina puede ocasionar malestar estomacal, confusión, ansiedad y trastornos del sueño.`,
    ];
    let prescription = {
        supplement: 'Cafeina',
        requirement: requirement,
        dosageIndication: dosageIndication,
        intakeIndication: intakeIndication,
        effects: effects,
        considerations: considerations,
    }
    return prescription;
}

function nitratoPrescription(){
    let requirement = 400;
    let dosageIndication = `${requirement} mg pre ejercicio.`
    let intakeIndication = `Incluir suplemento de concentrado de betarrada, o en su defecto, preparar un batido de betarraga con 1 betarraga 
    grande (200gr) y 300ml de agua. Ingerir suplemento o jugo de betarraga 2 horas antes de iniciar la actividad deportiva.`;
    let effects = [
        `La suplementación con nitrato aumenta el nivel en sangre de oxido nitrico, generando un efecto vasodilatador y aumentando la oxigenación
        muscular.`
    ];
    let considerations = [
        `Consumir solo la dosis indicada. El consumo excesivo de cafeina puede ocasionar malestar estomacal, confusión, ansiedad y trastornos del sueño. Esto aumenta el rendimiento en ejercicios de resistencia (running o ciclismo) así como deportes de equipo (futbol, hockey, rugby).`,
    ];
    let prescription = {
        supplement: 'Nitrato',
        requirement: requirement,
        dosageIndication: dosageIndication,
        intakeIndication: intakeIndication,
        effects: effects,
        considerations: considerations,
    }
    return prescription;
}

function bicarbonatoPrescription(peso: number){
    let requirement = peso * 0.3;
    let ml = peso * 10;
    let carbohidrato = peso * 1.5;
    let comida = () => {
        if(carbohidrato <= 75){
            return 'comida con 75g de carbo';
        }else if(carbohidrato <= 90){
            return 'comida con 90gr de carbo'
        }else if(carbohidrato <= 105){
            return 'comida con 105gr de carbo'
        }else if(carbohidrato <= 120){
            return 'comida con 120gr de carbo'
        }else if(carbohidrato <= 135){
            return 'comida con 135gr de carbo'
        }else if(carbohidrato <= 150){
            return 'comida con 150gr de carbo'
        }else if(carbohidrato <= 165){
            return 'comida con 165gr de carbo'
        }else{
            return 'comida con 180gr de carbo'
        }
    }
    let dosageIndication = `${requirement} gr diluido en ${ml} ml.`
    let intakeIndication = `Diluir ${requirement}gr de bicarbonato en ${ml}ml y acompañar con una comida que aporte 
    ${carbohidrato}gr de carbohidrato, como ${comida()}. Iniciar ingesta de suplemento 2 horas antes de la actividad deportiva. 
    Ingerir lenta y progresivamente durante 30-60 minutos.`;
    let effects = [
        `La suplementación con nitrato aumenta el nivel en sangre de oxido nitrico, generando un efecto vasodilatador y aumentando la oxigenación
        muscular.`
    ];
    let considerations = [
        `Consumir solo la dosis indicada. El consumo excesivo de cafeina puede ocasionar malestar estomacal, confusión, ansiedad y trastornos del sueño. Esto aumenta el rendimiento en ejercicios de resistencia (running o ciclismo) así como deportes de equipo (futbol, hockey, rugby).`,
    ];
    let prescription = {
        supplement: 'Bicarbonato',
        requirement: requirement,
        dosageIndication: dosageIndication,
        intakeIndication: intakeIndication,
        effects: effects,
        considerations: considerations,
    }
    return prescription;
}

export function calculoSuplementos(peso: number): SupplementsPrescription {

    const creatina = creatinaPrescription(peso);
    const cafeina = cafeinaPrescription(peso);
    const nitrato = nitratoPrescription();
    const bicarbonato = bicarbonatoPrescription(peso);

    const suplementosPrescription = {
        creatina: creatina,
        cafeina: cafeina,
        nitrato: nitrato,
        bicarbonato: bicarbonato,
    }

    return suplementosPrescription;

}
