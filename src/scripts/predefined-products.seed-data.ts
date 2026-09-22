import {
  buildPredefinedPlanCode,
  listPredefinedPlanSelections,
  PredefinedAgeGroup,
  PredefinedPlanFamily,
  PredefinedPlanSelection,
  PredefinedSex,
  PredefinedWeightRange,
} from '../domain/services/utils/predefined-plan-code';
import {
  buildPredefinedPlanKey,
  buildPredefinedPlanThumbnailKey,
} from '../presentation/storage/storage.service';

// Placeholder: no hay pricing real definido para los planes predefinidos. Ajustar con negocio antes
// de producción (puede variar por plan editando PRICE_BY_FAMILY). El precio de una orden siempre se
// toma de Product.price al crearla, así que cambiarlo acá y volver a correr el seed solo afecta a
// compras futuras.
export const PREDEFINED_PLAN_CURRENCY = 'CLP';
const DEFAULT_PRICE = 14990;
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

export interface PredefinedProductSeedRow {
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
  };
}

// Las 112 filas del catálogo de planes predefinidos.
export function buildAllPredefinedProductSeedRows(): PredefinedProductSeedRow[] {
  return listPredefinedPlanSelections().map(buildPredefinedProductSeedRow);
}
