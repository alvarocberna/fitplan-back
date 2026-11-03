export interface SupplementPrescription {
  supplement: string;
  requirement: number;
  dosageIndication: string;
  intakeIndication: string;
  effects: string[];
  considerations: string[];
  // Aporte nutricional del suplemento. Creatina, cafeina, nitrato y bicarbonato no aportan
  // energía ni macronutrientes relevantes: se dejan en 0 por consistencia con el shape de
  // "intake" usado en el resto del plan (mealTimes, planIntake).
  intake: {
    calories: number;
    protein: number;
    carbohydrate: number;
    fat: number;
  };
}

export interface SupplementsPrescription {
  creatine: SupplementPrescription;
  caffeine: SupplementPrescription;
  nitrate: SupplementPrescription;
  bicarbonate: SupplementPrescription;
}

function creatinePrescription(weight: number) {
  const requirement = Math.ceil(weight * 0.03 * 2) / 2;
  const dosageIndication = `${requirement} gr/día de creatina monohidratada.`;
  const intakeIndication = `Mezclar creatina con un liquido (agua) o un alimento (yogurt) y consumir acompañada de alimentos ricos en
    carbohidratos y proteina (como tostadas con huevo) para optimizar su absorción.`;
  const effects = [
    `La suplementación con creatina ayuda a aumentar el rendimiento y la recuperación en deportes o situaciones de alta intensidad, como
        sprints (100m & 200m), esfuerzos repetitivos de alta intensidad (deportes de equipo o tenis) o el sprint final de una carrera de resistencia. `,
  ];
  const considerations = [
    'Considerar que puede haber un posible aumento de 1-2kg de peso corporal causada por la retención de liquido intracelular a nivel muscular.',
  ];
  const prescription = {
    supplement: 'Creatina',
    requirement: requirement,
    dosageIndication: dosageIndication,
    intakeIndication: intakeIndication,
    effects: effects,
    considerations: considerations,
    intake: { calories: 0, protein: 0, carbohydrate: 0, fat: 0 },
  };
  return prescription;
}

function caffeinePrescription(weight: number) {
  const requirement = Math.ceil((weight * 1.5) / 5) * 5;
  const dosageIndication = `${requirement} mg pre ejercicio.`;
  const intakeIndication = `Consumir capsula, gel o café con el aporte recomendado previo a la sesión de ejercicio.`;
  const effects = [
    `La suplementación con cafeina activa el sistema nervioso, reduce la percepción de esfuerzo y la sensación de dolor, además de mejorar el rendimiento. Se recomienda su uso en deportes que combinan resistencia y alta intensidad.`,
  ];
  const considerations = [
    `Consumir solo la dosis indicada. El consumo excesivo de cafeina puede ocasionar malestar estomacal, confusión, ansiedad y trastornos del sueño.`,
  ];
  const prescription = {
    supplement: 'Cafeina',
    requirement: requirement,
    dosageIndication: dosageIndication,
    intakeIndication: intakeIndication,
    effects: effects,
    considerations: considerations,
    intake: { calories: 0, protein: 0, carbohydrate: 0, fat: 0 },
  };
  return prescription;
}

function nitratePrescription() {
  const requirement = 400;
  const dosageIndication = `${requirement} mg pre ejercicio.`;
  const intakeIndication = `Incluir suplemento de concentrado de betarrada, o en su defecto, preparar un batido de betarraga con 1 betarraga
    grande (200gr) y 300ml de agua. Ingerir suplemento o jugo de betarraga 2 horas antes de iniciar la actividad deportiva.`;
  const effects = [
    `La suplementación con nitrato aumenta el nivel en sangre de oxido nitrico, generando un efecto vasodilatador y aumentando la oxigenación
        muscular.`,
  ];
  const considerations = [
    `Consumir solo la dosis indicada. El consumo excesivo de cafeina puede ocasionar malestar estomacal, confusión, ansiedad y trastornos del sueño. Esto aumenta el rendimiento en ejercicios de resistencia (running o ciclismo) así como deportes de equipo (futbol, hockey, rugby).`,
  ];
  const prescription = {
    supplement: 'Nitrato',
    requirement: requirement,
    dosageIndication: dosageIndication,
    intakeIndication: intakeIndication,
    effects: effects,
    considerations: considerations,
    intake: { calories: 0, protein: 0, carbohydrate: 0, fat: 0 },
  };
  return prescription;
}

function bicarbonatePrescription(weight: number) {
  const requirement = weight * 0.3;
  const ml = weight * 10;
  const carbohydrate = weight * 1.5;
  const meal = () => {
    if (carbohydrate <= 75) {
      return 'comida con 75g de carbo';
    } else if (carbohydrate <= 90) {
      return 'comida con 90gr de carbo';
    } else if (carbohydrate <= 105) {
      return 'comida con 105gr de carbo';
    } else if (carbohydrate <= 120) {
      return 'comida con 120gr de carbo';
    } else if (carbohydrate <= 135) {
      return 'comida con 135gr de carbo';
    } else if (carbohydrate <= 150) {
      return 'comida con 150gr de carbo';
    } else if (carbohydrate <= 165) {
      return 'comida con 165gr de carbo';
    } else {
      return 'comida con 180gr de carbo';
    }
  };
  const dosageIndication = `${requirement} gr diluido en ${ml} ml.`;
  const intakeIndication = `Diluir ${requirement}gr de bicarbonato en ${ml}ml y acompañar con una comida que aporte
    ${carbohydrate}gr de carbohidrato, como ${meal()}. Iniciar ingesta de suplemento 2 horas antes de la actividad deportiva.
    Ingerir lenta y progresivamente durante 30-60 minutos.`;
  const effects = [
    `La suplementación con nitrato aumenta el nivel en sangre de oxido nitrico, generando un efecto vasodilatador y aumentando la oxigenación
        muscular.`,
  ];
  const considerations = [
    `Consumir solo la dosis indicada. El consumo excesivo de cafeina puede ocasionar malestar estomacal, confusión, ansiedad y trastornos del sueño. Esto aumenta el rendimiento en ejercicios de resistencia (running o ciclismo) así como deportes de equipo (futbol, hockey, rugby).`,
  ];
  const prescription = {
    supplement: 'Bicarbonato',
    requirement: requirement,
    dosageIndication: dosageIndication,
    intakeIndication: intakeIndication,
    effects: effects,
    considerations: considerations,
    intake: { calories: 0, protein: 0, carbohydrate: 0, fat: 0 },
  };
  return prescription;
}

export function calculateSupplements(weight: number): SupplementsPrescription {
  const creatine = creatinePrescription(weight);
  const caffeine = caffeinePrescription(weight);
  const nitrate = nitratePrescription();
  const bicarbonate = bicarbonatePrescription(weight);

  const supplementsPrescription = {
    creatine: creatine,
    caffeine: caffeine,
    nitrate: nitrate,
    bicarbonate: bicarbonate,
  };

  return supplementsPrescription;
}
