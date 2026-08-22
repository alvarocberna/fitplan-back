
export interface PersonalInfoDto {
    rut: number | null
    dvRut: string | null
    firstName: string | null
    middleName: string | null
    paternalLastName: string | null
    maternalLastName: string | null
    gender: string | null
    athlete: boolean | null
    email: string | null
    dateOfBirth: Date | null
}

export interface GoalsDto{
    primaryGoal: string | null
    secondaryGoal: string[] | null
}

export interface ClinicalAnamnesisDto {
    pathology: string | null
    familyMedicalHistory: string | null
    allergies: string | null
    intolerances: string | null
    medications: string | null
    gastrointestinalHistory: string | null
    bowelMovements: string | null
    surgeries: string | null
}

export interface DietaryAnamnesisDto {
    r24h: Meal[] | null,
    foodPreferenceGroups: FoodPreferenceGroup[] | null,
    sportsStrategy: SportsStrategy | null,
}

export interface Meal {
    mealTime: string | null
    carbohydrate: string | null
    freeConsumptionVegetable: string | null
    generalConsumptionVegetable: string | null
    fruit: string | null
    highFatProtein: string | null
    lowFatProtein: string | null
    highFatDairy: string | null
    mediumFatDairy: string | null
    lowFatDairy: string | null
    highProteinDairy: string | null
    highLipid: string | null
    oil: string | null
    sugar: string | null
    alcohol: string | null
}

export interface FoodPreferenceGroup {
  group: string;
  frequentConsumption: string[];
  occasionalConsumption: string[];
  rareConsumption: string[];
  avoidedFoods: string[];
}

export interface SportsStrategy {
    supplement: string[] | null
    hydration: string[] | null
    preActivityMeal: string | null
    duringActivityMeal: string | null
    postActivityMeal: string | null
}

export interface HealthyLifestyleDto {
    alcohol: string | null
    tobacco: string | null
    physicalActivityLevel: string | null
    sport: string[] | null
    // sessionTraining: string[] | null,
    sportSession: {
        description: string | null,
        discipline: string | null,
        duration: number | null,
        intensity: string | null,
        eventType: string | null, //entrenamiento o competencia
        days: string | null,
        schedule: string | null,
    }[] | null
}

export interface AnamnesisDto {
    goals: GoalsDto | null
    clinical: ClinicalAnamnesisDto | null
    dietary: DietaryAnamnesisDto | null
    lifestyle: HealthyLifestyleDto | null
}

export interface MeasurementsDto {
    weight: number | null
    height: number | null
    somatotype: string | null
}

export interface CompleteConsultationDto {
    personalInfo: PersonalInfoDto | null
    anamnesis: AnamnesisDto | null
    measurements: MeasurementsDto | null
}
