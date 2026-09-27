import {
  buildPredefinedPlanCode,
  listPredefinedPlanSelections,
  PREDEFINED_PLAN_FAMILIES,
  PredefinedAgeGroup,
  PredefinedPlanFamily,
  PredefinedPlanSelection,
  PredefinedSex,
  PredefinedWeightRange,
} from '../domain/services/utils/predefined-plan-code';
import {
  buildPredefinedPlanKey,
  buildPredefinedPlanThumbnailKey,
} from '../domain/services/utils/storage-keys';

// Placeholder: no hay pricing real definido para los planes predefinidos. Ajustar con negocio antes
// de producción (puede variar por plan editando PRICE_BY_FAMILY). El precio de una orden siempre se
// toma de Product.price al crearla, así que cambiarlo acá y volver a correr el seed solo afecta a
// compras futuras.
export const PREDEFINED_PLAN_CURRENCY = 'CLP';
const DEFAULT_PRICE = 5990;
const PRICE_BY_FAMILY: Partial<Record<PredefinedPlanFamily, number>> = {};

const FAMILY_TITLE: Record<PredefinedPlanFamily, string> = {
  'plan-gimnasio-volumen': 'Plan Gimnasio Volumen',
  'plan-gimnasio-definicion': 'Plan Gimnasio Definición',
  'plan-running': 'Plan Running',
  'plan-deporte-cancha': 'Plan Deporte de Cancha',
};

// Cada rango es semiabierto ('50-60' cubre 50–59.9 kg), salvo el último, que llega a 120.
const WEIGHT_LABEL: Record<PredefinedWeightRange, string> = {
  '40-50': '40–49.9 kg',
  '50-60': '50–59.9 kg',
  '60-70': '60–69.9 kg',
  '70-80': '70–79.9 kg',
  '80-90': '80–89.9 kg',
  '90-100': '90–99.9 kg',
  '100-120': '100–120 kg',
};

const SEX_LABEL: Record<PredefinedSex, string> = {
  m: 'Hombre',
  f: 'Mujer',
};

const AGE_LABEL: Record<PredefinedAgeGroup, string> = {
  joven: 'menor de 30 años',
  adulto: '30 años o más',
};

// Descripción de la fila "vista previa" de cada familia (sin peso/sexo/edad): más amplia que la de
// una versión puntual, pero con la misma información (el deporte/objetivo del plan).
const PLAN_PREVIEW_DESCRIPTION: Record<PredefinedPlanFamily, string> = {
  'plan-gimnasio-volumen':
    'Plan nutricional para entrenamiento de gimnasio en periodo de volumen.',
  'plan-gimnasio-definicion':
    'Plan nutricional para entrenamiento de gimnasio en periodo de definición.',
  'plan-running': 'Plan nutricional para entrenamiento de running.',
  'plan-deporte-cancha': 'Plan nutricional para deportes de cancha.',
};

// Resumen nutricional FICTICIO (no calculado con las fórmulas reales de domain/services/formulas/,
// esas son para el plan personalizado) — placeholder plausible para poder mostrar algo en el perfil
// cuando un plan predefinido (que no genera NutritionalPlan) aparezca ahí. goal/dietRegimen por
// familia; kcal/proteína/carbohidratos/lípidos varían con el peso y el sexo de la versión para no
// repetir el mismo número en las 112 filas.
interface FamilyNutritionProfile {
  goal: string;
  dietRegimen: string;
  kcalPerKg: number; // kcal objetivo por kg de peso corporal
  proteinPct: number; // fracción de las kcal totales que aportan las macros (suman 1)
  carbohydratePct: number;
  lipidPct: number;
}

const FAMILY_NUTRITION: Record<PredefinedPlanFamily, FamilyNutritionProfile> = {
  'plan-gimnasio-volumen': {
    goal: 'Aumento de masa muscular',
    dietRegimen: 'Hipercalórico hiperproteico',
    kcalPerKg: 35,
    proteinPct: 0.3,
    carbohydratePct: 0.45,
    lipidPct: 0.25,
  },
  'plan-gimnasio-definicion': {
    goal: 'Reducción de grasa corporal',
    dietRegimen: 'Hipocalórico hiperproteico',
    kcalPerKg: 24,
    proteinPct: 0.35,
    carbohydratePct: 0.35,
    lipidPct: 0.3,
  },
  'plan-running': {
    goal: 'Mejora del rendimiento en resistencia',
    dietRegimen: 'Normocalórico alto en carbohidratos',
    kcalPerKg: 30,
    proteinPct: 0.2,
    carbohydratePct: 0.55,
    lipidPct: 0.25,
  },
  'plan-deporte-cancha': {
    goal: 'Rendimiento y recuperación en deportes de equipo',
    dietRegimen: 'Normocalórico balanceado',
    kcalPerKg: 32,
    proteinPct: 0.25,
    carbohydratePct: 0.5,
    lipidPct: 0.25,
  },
};

// Punto medio en kg de cada rango de peso del código ('50-60' cubre 50–59.9 kg -> 55).
const WEIGHT_MIDPOINT_KG: Record<PredefinedWeightRange, number> = {
  '40-50': 45,
  '50-60': 55,
  '60-70': 65,
  '70-80': 75,
  '80-90': 85,
  '90-100': 95,
  '100-120': 110,
};

// Peso "representativo" para la fila vista previa de una familia (no tiene peso propio).
const PREVIEW_REPRESENTATIVE_WEIGHT_KG = 70;

const SEX_FACTOR: Record<PredefinedSex, number> = { m: 1.08, f: 1 };
// Sin sexo específico (fila vista previa): promedio de ambos factores.
const NEUTRAL_SEX_FACTOR =
  (SEX_FACTOR.m + SEX_FACTOR.f) / 2;

export interface NutritionSummary {
  goal: string;
  dietRegimen: string;
  calorieIntake: number;
  proteinIntake: number;
  carbohydrateIntake: number;
  lipidIntake: number;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function buildFictitiousNutritionSummary(
  family: PredefinedPlanFamily,
  weightKg: number,
  sexFactor: number,
): NutritionSummary {
  const profile = FAMILY_NUTRITION[family];
  const calorieIntake = Math.round((weightKg * profile.kcalPerKg * sexFactor) / 10) * 10;

  return {
    goal: profile.goal,
    dietRegimen: profile.dietRegimen,
    calorieIntake,
    proteinIntake: round1((calorieIntake * profile.proteinPct) / 4),
    carbohydrateIntake: round1((calorieIntake * profile.carbohydratePct) / 4),
    lipidIntake: round1((calorieIntake * profile.lipidPct) / 9),
  };
}

export interface PredefinedProductSeedRow extends NutritionSummary {
  code: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  pdfKey: string;
  thumbnailKey: string;
}

export function buildPredefinedProductSeedRow(
  selection: PredefinedPlanSelection,
): PredefinedProductSeedRow {
  const code = buildPredefinedPlanCode(selection);
  const { family, weightRange, sex, ageGroup } = selection;
  const title = FAMILY_TITLE[family];

  return {
    code,
    name: `${title} · ${WEIGHT_LABEL[weightRange]} · ${SEX_LABEL[sex]} · ${AGE_LABEL[ageGroup]}`,
    description: `${title} estandarizado para ${SEX_LABEL[sex].toLowerCase()} de ${WEIGHT_LABEL[weightRange]}, ${AGE_LABEL[ageGroup]}.`,
    price: PRICE_BY_FAMILY[family] ?? DEFAULT_PRICE,
    currency: PREDEFINED_PLAN_CURRENCY,
    pdfKey: buildPredefinedPlanKey(code),
    thumbnailKey: buildPredefinedPlanThumbnailKey(code),
    ...buildFictitiousNutritionSummary(
      family,
      WEIGHT_MIDPOINT_KG[weightRange],
      SEX_FACTOR[sex],
    ),
  };
}

// Las 112 filas del catálogo de planes predefinidos.
export function buildAllPredefinedProductSeedRows(): PredefinedProductSeedRow[] {
  return listPredefinedPlanSelections().map(buildPredefinedProductSeedRow);
}

// Fila "vista previa" de una familia: sin peso/sexo/edad (code = solo el slug del plan) y sin PDF
// (pdfKey null — es solo la miniatura que usa el carrusel del home, no un plan comprable).
export interface PlanPreviewSeedRow extends NutritionSummary {
  code: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  pdfKey: null;
  thumbnailKey: string;
}

export function buildPlanPreviewSeedRow(
  family: PredefinedPlanFamily,
): PlanPreviewSeedRow {
  return {
    code: family,
    name: FAMILY_TITLE[family],
    description: PLAN_PREVIEW_DESCRIPTION[family],
    price: PRICE_BY_FAMILY[family] ?? DEFAULT_PRICE,
    currency: PREDEFINED_PLAN_CURRENCY,
    pdfKey: null,
    thumbnailKey: buildPredefinedPlanThumbnailKey(family),
    ...buildFictitiousNutritionSummary(
      family,
      PREVIEW_REPRESENTATIVE_WEIGHT_KG,
      NEUTRAL_SEX_FACTOR,
    ),
  };
}

// Las (hasta) 4 filas "vista previa", una por familia.
export function buildAllPlanPreviewSeedRows(): PlanPreviewSeedRow[] {
  return PREDEFINED_PLAN_FAMILIES.map(buildPlanPreviewSeedRow);
}
