import {
  buildAllPredefinedProductSeedRows,
  buildAllPlanPreviewSeedRows,
  buildPlanPreviewSeedRow,
  buildPredefinedProductSeedRow,
} from './predefined-products.seed-data';
import { PREDEFINED_PLAN_FAMILIES } from '../domain/services/utils/predefined-plan-code';

describe('predefined-products.seed-data', () => {
  it('arma la fila de una versión con code, keys de S3 derivadas del code y nombre legible', () => {
    const row = buildPredefinedProductSeedRow({
      family: 'plan-gimnasio-volumen',
      weightRange: '50-60',
      sex: 'm',
      ageGroup: 'joven',
    });

    expect(row).toMatchObject({
      code: 'plan-gimnasio-volumen-50-60-m-joven',
      name: 'Plan Gimnasio Volumen · 50–59.9 kg · Hombre · menor de 30 años',
      currency: 'CLP',
      pdfKey: 'productos-estandarizados/plan-gimnasio-volumen-50-60-m-joven.pdf',
      thumbnailKey: 'productos-estandarizados/miniaturas/plan-gimnasio-volumen-50-60-m-joven.webp',
      // resumen nutricional ficticio (no las fórmulas reales de domain/services/formulas/), pero
      // coherente con el peso (55 kg, punto medio de 50-60) y el sexo de la versión
      goal: 'Aumento de masa muscular',
      dietRegimen: 'Hipercalórico hiperproteico',
      calorieIntake: 2080,
      proteinIntake: 156,
      carbohydrateIntake: 234,
      lipidIntake: 57.8,
    });
    expect(row.price).toBeGreaterThan(0);
  });

  it('el resumen nutricional ficticio varía con el peso y el sexo (no es el mismo número repetido)', () => {
    const light = buildPredefinedProductSeedRow({
      family: 'plan-gimnasio-volumen',
      weightRange: '40-50',
      sex: 'f',
      ageGroup: 'joven',
    });
    const heavy = buildPredefinedProductSeedRow({
      family: 'plan-gimnasio-volumen',
      weightRange: '100-120',
      sex: 'm',
      ageGroup: 'joven',
    });

    expect(heavy.calorieIntake).toBeGreaterThan(light.calorieIntake);
    expect(heavy.proteinIntake).toBeGreaterThan(light.proteinIntake);
    // mismo objetivo/régimen dentro de una misma familia, sí o sí
    expect(heavy.goal).toBe(light.goal);
    expect(heavy.dietRegimen).toBe(light.dietRegimen);
  });

  it('el objetivo y régimen difieren entre familias', () => {
    const volumen = buildPredefinedProductSeedRow({
      family: 'plan-gimnasio-volumen',
      weightRange: '60-70',
      sex: 'm',
      ageGroup: 'joven',
    });
    const definicion = buildPredefinedProductSeedRow({
      family: 'plan-gimnasio-definicion',
      weightRange: '60-70',
      sex: 'm',
      ageGroup: 'joven',
    });

    expect(volumen.goal).not.toBe(definicion.goal);
    expect(volumen.dietRegimen).not.toBe(definicion.dietRegimen);
  });

  it('genera las 112 filas con code y keys únicos', () => {
    const rows = buildAllPredefinedProductSeedRows();

    expect(rows).toHaveLength(112);
    expect(new Set(rows.map((r) => r.code)).size).toBe(112);
    expect(new Set(rows.map((r) => r.pdfKey)).size).toBe(112);
    expect(new Set(rows.map((r) => r.thumbnailKey)).size).toBe(112);
  });
});

describe('buildPlanPreviewSeedRow / buildAllPlanPreviewSeedRows', () => {
  it('arma la fila de vista previa de una familia: code = solo el slug, sin PDF, con su miniatura', () => {
    const row = buildPlanPreviewSeedRow('plan-gimnasio-definicion');

    expect(row).toEqual({
      code: 'plan-gimnasio-definicion',
      name: 'Plan Gimnasio Definición',
      description: 'Plan nutricional para entrenamiento de gimnasio en periodo de definición.',
      price: 5990,
      currency: 'CLP',
      pdfKey: null,
      thumbnailKey: 'productos-estandarizados/miniaturas/plan-gimnasio-definicion.webp',
      goal: 'Reducción de grasa corporal',
      dietRegimen: 'Hipocalórico hiperproteico',
      calorieIntake: 1750,
      proteinIntake: 153.1,
      carbohydrateIntake: 153.1,
      lipidIntake: 58.3,
    });
  });

  it('genera una fila por familia (4), con code y thumbnailKey únicos y pdfKey siempre null', () => {
    const rows = buildAllPlanPreviewSeedRows();

    expect(rows).toHaveLength(PREDEFINED_PLAN_FAMILIES.length);
    expect(rows.map((r) => r.code)).toEqual([...PREDEFINED_PLAN_FAMILIES]);
    expect(new Set(rows.map((r) => r.code)).size).toBe(rows.length);
    expect(new Set(rows.map((r) => r.thumbnailKey)).size).toBe(rows.length);
    expect(rows.every((r) => r.pdfKey === null)).toBe(true);
    expect(rows.every((r) => r.price === 5990)).toBe(true);
    // cada familia tiene su propio objetivo/régimen y un resumen calórico > 0 (ficticio, pero no vacío)
    expect(new Set(rows.map((r) => r.goal)).size).toBe(rows.length);
    expect(new Set(rows.map((r) => r.dietRegimen)).size).toBe(rows.length);
    expect(rows.every((r) => r.calorieIntake > 0)).toBe(true);
    expect(rows.every((r) => r.proteinIntake > 0)).toBe(true);
    expect(rows.every((r) => r.carbohydrateIntake > 0)).toBe(true);
    expect(rows.every((r) => r.lipidIntake > 0)).toBe(true);
  });
});
