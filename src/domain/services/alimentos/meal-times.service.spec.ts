import { normalizeMealTime, isMainMealTime, determineMealTimes } from './meal-times.service';
import { Meal } from '../../dtos/consultation.dto';

function makeMeal(mealTime: string, overrides: Partial<Meal> = {}): Meal {
  return {
    mealTime,
    cereals: null,
    freeConsumptionVegetable: null,
    generalConsumptionVegetable: null,
    fruit: null,
    highFatProtein: null,
    lowFatProtein: null,
    highFatDairy: null,
    mediumFatDairy: null,
    lowFatDairy: null,
    highProteinDairy: null,
    highLipid: null,
    oil: null,
    sugar: null,
    alcohol: null,
    ...overrides,
  };
}

describe('normalizeMealTime', () => {
  it('reconoce cada tipo de tiempo de comida ignorando tildes/mayúsculas', () => {
    expect(normalizeMealTime('Desayuno')).toBe('desayuno');
    expect(normalizeMealTime('ALMUERZO')).toBe('almuerzo');
    expect(normalizeMealTime('Once')).toBe('once');
    expect(normalizeMealTime('cena')).toBe('cena');
    expect(normalizeMealTime('Colación')).toBe('colacion');
  });

  it('devuelve null para valores no reconocidos o vacíos', () => {
    expect(normalizeMealTime('brunch')).toBeNull();
    expect(normalizeMealTime(null)).toBeNull();
    expect(normalizeMealTime(undefined)).toBeNull();
  });
});

describe('isMainMealTime', () => {
  it('la colación no es un tiempo principal; el resto sí', () => {
    expect(isMainMealTime('colacion')).toBe(false);
    expect(isMainMealTime('desayuno')).toBe(true);
    expect(isMainMealTime('almuerzo')).toBe(true);
  });
});

describe('determineMealTimes', () => {
  it('con 1 tiempo reportado, completa a 3 principales + 1 colación (goal no-volumen)', () => {
    const result = determineMealTimes([makeMeal('desayuno', { cereals: 'pan' })], 'mantencion');

    expect(result.map((m) => m.mealTime)).toEqual(['desayuno', 'almuerzo', 'colación', 'once']);
    // el tiempo reportado conserva su contenido original
    expect(result[0].cereals).toBe('pan');
    // los tiempos agregados quedan vacíos
    expect(result[1].cereals).toBeNull();
  });

  it('con los 4 principales reportados y goal "volumen", agrega 1 colación', () => {
    const r24h = [makeMeal('desayuno'), makeMeal('almuerzo'), makeMeal('once'), makeMeal('cena')];
    const result = determineMealTimes(r24h, 'volumen');

    expect(result.map((m) => m.mealTime)).toEqual([
      'desayuno',
      'almuerzo',
      'colación',
      'once',
      'cena',
    ]);
  });

  it('con los 4 principales reportados y goal distinto de "volumen", no agrega nada', () => {
    const r24h = [makeMeal('desayuno'), makeMeal('almuerzo'), makeMeal('once'), makeMeal('cena')];
    const result = determineMealTimes(r24h, 'mantencion');

    expect(result.map((m) => m.mealTime)).toEqual(['desayuno', 'almuerzo', 'once', 'cena']);
  });

  it('con 4 principales + 2 colaciones ya reportadas, las conserva y reparte en huecos sucesivos', () => {
    const r24h = [
      makeMeal('desayuno'),
      makeMeal('almuerzo'),
      makeMeal('colación', { fruit: 'manzana' }),
      makeMeal('once'),
      makeMeal('cena'),
      makeMeal('colación', { fruit: 'plátano' }),
    ];
    const result = determineMealTimes(r24h, 'mantencion');

    expect(result.map((m) => m.mealTime)).toEqual([
      'desayuno',
      'colación',
      'almuerzo',
      'colación',
      'once',
      'cena',
    ]);
    // se preserva el contenido original de cada colación reportada, en el mismo orden en que llegaron
    expect(result.filter((m) => m.mealTime === 'colación').map((m) => m.fruit)).toEqual([
      'manzana',
      'plátano',
    ]);
  });

  it('sin ningún tiempo reportado (r24h null), igual completa la estructura base', () => {
    const result = determineMealTimes(null, 'mantencion');
    expect(result.map((m) => m.mealTime)).toEqual(['desayuno', 'almuerzo', 'colación', 'once']);
    expect(result.every((m) => m.cereals === null)).toBe(true);
  });
});
