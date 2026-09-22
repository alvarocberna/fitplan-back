import {
  buildAllPredefinedProductSeedRows,
  buildPredefinedProductSeedRow,
} from './predefined-products.seed-data';

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
    });
    expect(row.price).toBeGreaterThan(0);
  });

  it('genera las 112 filas con code y keys únicos', () => {
    const rows = buildAllPredefinedProductSeedRows();

    expect(rows).toHaveLength(112);
    expect(new Set(rows.map((r) => r.code)).size).toBe(112);
    expect(new Set(rows.map((r) => r.pdfKey)).size).toBe(112);
    expect(new Set(rows.map((r) => r.thumbnailKey)).size).toBe(112);
  });
});
