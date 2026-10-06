import { plainToInstance } from 'class-transformer';
import {
  AnamnesisDtoImpl,
  GoalsDtoImpl,
  ClinicalAnamnesisDtoImpl,
  DietaryAnamnesisDtoImpl,
  MealDtoImpl,
  FoodPreferenceGroupDtoImpl,
  SportsStrategyDtoImpl,
  HealthyLifestyleDtoImpl,
  SportSessionDtoImpl,
} from './consultation.dto';

// Repara variaciones de forma que el LLM suele producir (campos anidados en vez de planos,
// arrays donde se esperaba texto, etc.) antes de que corran whitelist/class-validator, para
// que un desvío del modelo respecto al esquema no tumbe la request con un 400.

const MEAL_KEYS = [
  'mealTime',
  'cereals',
  'freeConsumptionVegetable',
  'generalConsumptionVegetable',
  'fruit',
  'highFatProtein',
  'lowFatProtein',
  'highFatDairy',
  'mediumFatDairy',
  'lowFatDairy',
  'highProteinDairy',
  'highLipid',
  'oil',
  'sugar',
  'alcohol',
] as const;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function toStringOrNull(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === 'string') return value || null;
  if (Array.isArray(value)) {
    const joined = value.map(toStringOrNull).filter((v): v is string => !!v).join(', ');
    return joined || null;
  }
  if (isPlainObject(value)) {
    // valor anidado inesperado: intenta rescatar el primer valor útil en vez de fallar
    return toStringOrNull(Object.values(value)[0]);
  }
  return String(value);
}

function toStringArrayOrNull(value: unknown): string[] | null {
  if (value == null) return null;
  const arr = Array.isArray(value) ? value : [value];
  const result = arr.map(toStringOrNull).filter((v): v is string => !!v);
  return result.length ? result : null;
}

function toNumberOrNull(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

// Repara el caso donde el modelo anida los campos de una comida bajo el nombre de esa
// comida, ej. { desayuno: { mealTime: ..., cereals: ... } } en vez del
// objeto plano { mealTime: "desayuno", cereals: ... } que espera MealDtoImpl.
function normalizeMeal(raw: unknown): MealDtoImpl {
  const empty = Object.fromEntries(MEAL_KEYS.map((key) => [key, null]));
  if (!isPlainObject(raw)) return plainToInstance(MealDtoImpl, empty);

  let source: Record<string, unknown> = raw;
  let inferredMealTime: string | null = null;

  const wrapperKey = Object.keys(raw).find(
    (key) => !(MEAL_KEYS as readonly string[]).includes(key) && isPlainObject(raw[key]),
  );
  if (wrapperKey) {
    inferredMealTime = wrapperKey;
    source = raw[wrapperKey] as Record<string, unknown>;
  }

  const result: Record<string, string | null> = {};
  for (const key of MEAL_KEYS) {
    result[key] = toStringOrNull(source[key]);
  }
  if (!result.mealTime) result.mealTime = inferredMealTime;

  return plainToInstance(MealDtoImpl, result);
}

function normalizeR24h(raw: unknown): MealDtoImpl[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  return raw.map(normalizeMeal);
}

function normalizeGoals(raw: unknown): GoalsDtoImpl | null {
  if (!isPlainObject(raw)) return null;
  return plainToInstance(GoalsDtoImpl, {
    primaryGoal: toStringOrNull(raw.primaryGoal),
    secondaryGoal: toStringArrayOrNull(raw.secondaryGoal),
  });
}

function normalizeClinical(raw: unknown): ClinicalAnamnesisDtoImpl | null {
  if (!isPlainObject(raw)) return null;
  return plainToInstance(ClinicalAnamnesisDtoImpl, {
    pathology: toStringOrNull(raw.pathology),
    familyMedicalHistory: toStringOrNull(raw.familyMedicalHistory),
    allergies: toStringOrNull(raw.allergies),
    intolerances: toStringOrNull(raw.intolerances),
    medications: toStringOrNull(raw.medications),
    gastrointestinalHistory: toStringOrNull(raw.gastrointestinalHistory),
    bowelMovements: toStringOrNull(raw.bowelMovements),
    surgeries: toStringOrNull(raw.surgeries),
  });
}

function normalizeFoodPreferenceGroup(raw: unknown): FoodPreferenceGroupDtoImpl | null {
  if (!isPlainObject(raw)) return null;
  return plainToInstance(FoodPreferenceGroupDtoImpl, {
    group: toStringOrNull(raw.group) ?? '',
    frequentConsumption: toStringArrayOrNull(raw.frequentConsumption) ?? [],
    occasionalConsumption: toStringArrayOrNull(raw.occasionalConsumption) ?? [],
    rareConsumption: toStringArrayOrNull(raw.rareConsumption) ?? [],
    avoidedFoods: toStringArrayOrNull(raw.avoidedFoods) ?? [],
  });
}

function normalizeFoodPreferenceGroups(raw: unknown): FoodPreferenceGroupDtoImpl[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const result = raw
    .map(normalizeFoodPreferenceGroup)
    .filter((g): g is FoodPreferenceGroupDtoImpl => g !== null);
  return result.length ? result : null;
}

function normalizeSportsStrategy(raw: unknown): SportsStrategyDtoImpl | null {
  if (!isPlainObject(raw)) return null;
  return plainToInstance(SportsStrategyDtoImpl, {
    supplement: toStringArrayOrNull(raw.supplement),
    hydration: toStringArrayOrNull(raw.hydration),
    preActivityMeal: toStringOrNull(raw.preActivityMeal),
    duringActivityMeal: toStringOrNull(raw.duringActivityMeal),
    postActivityMeal: toStringOrNull(raw.postActivityMeal),
  });
}

function normalizeDietary(raw: unknown): DietaryAnamnesisDtoImpl | null {
  if (!isPlainObject(raw)) return null;
  return plainToInstance(DietaryAnamnesisDtoImpl, {
    r24h: normalizeR24h(raw.r24h),
    foodPreferenceGroups: normalizeFoodPreferenceGroups(raw.foodPreferenceGroups),
    sportsStrategy: normalizeSportsStrategy(raw.sportsStrategy),
  });
}

// Repara el caso donde el modelo anida los campos de una sesión deportiva bajo un
// nombre envolvente, análogo a normalizeMeal.
function normalizeSportSession(raw: unknown): SportSessionDtoImpl | null {
  if (!isPlainObject(raw)) return null;
  return plainToInstance(SportSessionDtoImpl, {
    description: toStringOrNull(raw.description),
    discipline: toStringOrNull(raw.discipline),
    duration: toNumberOrNull(raw.duration),
    intensity: toStringOrNull(raw.intensity),
    eventType: toStringOrNull(raw.eventType),
    days: toStringOrNull(raw.days),
    schedule: toStringOrNull(raw.schedule),
  });
}

function normalizeSportSessions(raw: unknown): SportSessionDtoImpl[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const result = raw
    .map(normalizeSportSession)
    .filter((s): s is SportSessionDtoImpl => s !== null);
  return result.length ? result : null;
}

function normalizeLifestyle(raw: unknown): HealthyLifestyleDtoImpl | null {
  if (!isPlainObject(raw)) return null;
  return plainToInstance(HealthyLifestyleDtoImpl, {
    alcohol: toStringOrNull(raw.alcohol),
    tobacco: toStringOrNull(raw.tobacco),
    physicalActivityLevel: toStringOrNull(raw.physicalActivityLevel),
    sport: toStringArrayOrNull(raw.sport),
    sportSession: normalizeSportSessions(raw.sportSession),
  });
}

// Punto de entrada: reconstruye el objeto anamnesis quedándose solo con las claves
// conocidas del esquema (protege contra "property X should not exist") y corrigiendo
// tipos comunes que el LLM suele desviar (texto envuelto en objeto/array, etc.).
export function normalizeAnamnesisPayload(raw: unknown): AnamnesisDtoImpl | null {
  if (!isPlainObject(raw)) return null;

  return plainToInstance(AnamnesisDtoImpl, {
    goals: normalizeGoals(raw.goals),
    clinical: normalizeClinical(raw.clinical),
    dietary: normalizeDietary(raw.dietary),
    lifestyle: normalizeLifestyle(raw.lifestyle),
  });
}
