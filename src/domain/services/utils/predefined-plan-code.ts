// Código de una versión de plan predefinido: <plan>-<pesoMin>-<pesoMax>-<sexo>-<edad>,
// p. ej. 'plan-gimnasio-volumen-50-60-m-joven'. Identifica a un Product PREDEFINED (Product.code) y es
// también el nombre de sus archivos en S3 (productos-estandarizados/<code>.pdf y .../miniaturas/<code>.webp).
//
// 4 planes × 7 rangos de peso × 2 sexos × 2 grupos de edad = 112 versiones. El frontend construye el
// código a partir de lo que el usuario completa; el backend nunca lo confía: valida el formato con
// PREDEFINED_PLAN_CODE_REGEX y toma precio y archivos del Product en la base de datos.

export const PREDEFINED_PLAN_FAMILIES = [
  'plan-gimnasio-volumen',
  'plan-gimnasio-definicion',
  'plan-running',
  'plan-deporte-cancha',
] as const;

// Rangos de peso en kg como [min, max] del segmento del código (el último es 100-120; el resto son
// intervalos de 10 kg, p. ej. '50-60' cubre 50–59.9 kg).
export const PREDEFINED_WEIGHT_RANGES = [
  '40-50',
  '50-60',
  '60-70',
  '70-80',
  '80-90',
  '90-100',
  '100-120',
] as const;

// m = masculino, f = femenino
export const PREDEFINED_SEXES = ['m', 'f'] as const;

// joven = menor de 30 años, adulto = 30 o más
export const PREDEFINED_AGE_GROUPS = ['joven', 'adulto'] as const;

export type PredefinedPlanFamily = (typeof PREDEFINED_PLAN_FAMILIES)[number];
export type PredefinedWeightRange = (typeof PREDEFINED_WEIGHT_RANGES)[number];
export type PredefinedSex = (typeof PREDEFINED_SEXES)[number];
export type PredefinedAgeGroup = (typeof PREDEFINED_AGE_GROUPS)[number];

export interface PredefinedPlanSelection {
  family: PredefinedPlanFamily;
  weightRange: PredefinedWeightRange;
  sex: PredefinedSex;
  ageGroup: PredefinedAgeGroup;
}

export const PREDEFINED_PLAN_CODE_REGEX = new RegExp(
  `^(${PREDEFINED_PLAN_FAMILIES.join('|')})-` +
    `(${PREDEFINED_WEIGHT_RANGES.join('|')})-` +
    `(${PREDEFINED_SEXES.join('|')})-` +
    `(${PREDEFINED_AGE_GROUPS.join('|')})$`,
);

export function isPredefinedPlanCode(value: unknown): value is string {
  return typeof value === 'string' && PREDEFINED_PLAN_CODE_REGEX.test(value);
}

export function buildPredefinedPlanCode(
  selection: PredefinedPlanSelection,
): string {
  const { family, weightRange, sex, ageGroup } = selection;
  return `${family}-${weightRange}-${sex}-${ageGroup}`;
}

// Las 112 combinaciones válidas (usado por el seed del catálogo).
export function listPredefinedPlanSelections(): PredefinedPlanSelection[] {
  const selections: PredefinedPlanSelection[] = [];
  for (const family of PREDEFINED_PLAN_FAMILIES) {
    for (const weightRange of PREDEFINED_WEIGHT_RANGES) {
      for (const sex of PREDEFINED_SEXES) {
        for (const ageGroup of PREDEFINED_AGE_GROUPS) {
          selections.push({ family, weightRange, sex, ageGroup });
        }
      }
    }
  }
  return selections;
}
