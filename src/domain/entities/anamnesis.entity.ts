// Mapea el árbol de anamnesis de prisma/schema.prisma (sección CLINICAL DOMAIN):
// Anamnesis -> Goals / AnamnesisClinical / AnamnesisDietary / AnamnesisPsychosocial / Lifestyle,
// y sus respectivos hijos.

import type { NutritionalConsultationEntity } from './clinical-record.entity';

export type SportsEventType = 'TRAINING' | 'COMPETITION';

export interface AnamnesisEntity {
  id: string;

  consultationId: string;
  consultation?: NutritionalConsultationEntity;

  goals?: GoalsEntity[];
  anamnesisClinical?: AnamnesisClinicalEntity[];
  anamnesisDietary?: AnamnesisDietaryEntity[];
  anamnesisPsychosocial?: AnamnesisPsychosocialEntity[];
  lifestyles?: LifestyleEntity[];
}

export interface GoalsEntity {
  id: string;

  anamnesisId: string;
  anamnesis?: AnamnesisEntity;

  mainGoal: string | null;
  secondaryGoal: string[];
}

export interface AnamnesisClinicalEntity {
  id: string;

  anamnesisId: string;
  anamnesis?: AnamnesisEntity;

  pathology: string[];
  familyHistory: string | null;
  allergy: string[];
  intolerance: string[];
  medication: string[];
  gastrointestinal: string[];
  surgery: string[];
  bowelMovement: string | null;
  exams: string | null;

  clinicalConditions?: ClinicalConditionEntity[];
}

// pathologies, allergies, intolerances, etc.
export interface ClinicalConditionEntity {
  id: string;

  anamnesisClinicalId: string;
  anamnesisClinical?: AnamnesisClinicalEntity;

  name: string | null;
  detail: string | null;
  type: string | null; // allergy, intolerance, etc
  snomedCtCode: string | null;
  status: string | null;
}

export interface AnamnesisDietaryEntity {
  id: string;

  anamnesisId: string;
  anamnesis?: AnamnesisEntity;

  dietType: string | null;

  dietaryRecalls24h?: DietaryRecall24hEntity[];
  foodPreferences?: FoodPreferenceEntity[];
  supplements?: SupplementsEntity[];
}

export interface DietaryRecall24hEntity {
  id: string;

  anamnesisDietaryId: string;
  anamnesisDietary?: AnamnesisDietaryEntity;

  meals?: DietaryRecall24hMealEntity[];
}

// dietary_recall_24h se compone de un arreglo de Meal (una fila por comida del recordatorio de 24h).
export interface DietaryRecall24hMealEntity {
  id: string;

  dietaryRecall24hId: string;
  dietaryRecall24h?: DietaryRecall24hEntity;

  mealTime: string;
  mealHour: string;
  description: string;
  carbohydrate: string;
  freeConsumptionVegetable: string;
  generalConsumptionVegetable: string;
  fruit: string;
  highFatProtein: string;
  lowFatProtein: string;
  highFatDairy: string;
  mediumFatDairy: string;
  lowFatDairy: string;
  highProteinDairy: string;
  lipidRich: string;
  oil: string;
  sugar: string;
  alcohol: string;
}

export interface FoodPreferenceEntity {
  id: string;

  anamnesisDietaryId: string;
  anamnesisDietary?: AnamnesisDietaryEntity;

  group: string | null;

  groups?: FoodPreferenceGroupEntity[];
}

// food_preference se compone de un arreglo de alimentos, clasificados por nivel de consumo.
export interface FoodPreferenceGroupEntity {
  id: string;

  foodPreferenceId: string;
  foodPreference?: FoodPreferenceEntity;

  group: string | null;
  frequentConsumption: string[];
  occasionalConsumption: string[];
  rareConsumption: string[];
  avoidedFoods: string[];
}

// supplements se compone de un arreglo de strings (un suplemento por fila).
export interface SupplementsEntity {
  id: string;

  anamnesisDietaryId: string;
  anamnesisDietary?: AnamnesisDietaryEntity;

  supplement: string;
  quantity: string | null;
  frequency: string | null;
  detail: string | null;
}

export interface AnamnesisPsychosocialEntity {
  id: string;

  anamnesisId: string;
  anamnesis?: AnamnesisEntity;

  occupation: string | null;
  education: string | null;
  income: string | null;
  familyGroup: string | null;
}

export interface LifestyleEntity {
  id: string;

  anamnesisId: string;
  anamnesis?: AnamnesisEntity;

  tobacco: string | null;
  alcohol: string | null;
  physicalActivityLevel: string | null;
  sport: string[];

  sportsSessions?: SportsSessionEntity[];
  sportsStrategies?: SportsStrategyEntity[];
}

// lifestyle puede tener múltiples sesiones deportivas.
export interface SportsSessionEntity {
  id: string;

  lifestyleId: string;
  lifestyle?: LifestyleEntity;

  description: string | null;
  discipline: string | null;
  duration: number | null;
  intensity: string | null;
  eventType: SportsEventType | null;
  days: string | null;
  schedule: string | null;
}

export interface SportsStrategyEntity {
  id: string;

  lifestyleId: string;
  lifestyle?: LifestyleEntity;

  supplement: string | null;
  hydration: string | null;
  preActivityMeal: string | null;
  duringActivityMeal: string | null;
  postActivityMeal: string | null;
}
