import {
  calculateProjection,
  evaluateGoalFeasibility,
  findLatestBodyComposition,
} from './projection.service';

const startDate = new Date('2026-01-15T00:00:00.000Z');

describe('calculateProjection', () => {
  it('ejemplo 01: 80 kg / 172 cm en definición proyecta 3 meses y 74 kg (IMC 25)', () => {
    const result = calculateProjection({
      goal: 'definicion',
      weight: 80,
      height: 172,
      gender: 'M',
      startDate,
    });
    expect(result.months).toBe(3);
    expect(result.endDate.toISOString().slice(0, 10)).toBe('2026-04-15');
    expect(result.projected).toEqual({
      weight: 74,
      bmi: 25,
      bfKg: null,
      bfPercentage: null,
      mmKg: null,
      mmPercentage: null,
    });
  });

  it('ejemplo 02: 64 kg / 172 cm acorta a 2 meses para no bajar de IMC 20', () => {
    const result = calculateProjection({
      goal: 'definicion',
      weight: 64,
      height: 172,
      gender: 'M',
      startDate,
    });
    expect(result.months).toBe(2);
    expect(result.projected?.weight).toBe(60);
    expect(result.projected?.bmi).toBe(20.3);
  });

  it('ejemplo 03: mujer de 60 kg y 24% GC acorta a 1 mes para no bajar de 20% GC', () => {
    const result = calculateProjection({
      goal: 'definicion',
      weight: 60,
      height: 165,
      gender: 'F',
      bfPercentage: 24,
      startDate,
    });
    expect(result.months).toBe(1);
    expect(result.projected?.weight).toBe(58);
    expect(result.projected?.bfKg).toBe(12.4);
    expect(result.projected?.bfPercentage).toBe(21.4);
  });

  it('ejemplo 04: 70 kg en volumen proyecta +2,1 kg de músculo en 3 meses', () => {
    const result = calculateProjection({
      goal: 'volumen',
      weight: 70,
      height: 175,
      gender: 'M',
      bfPercentage: 15,
      mmKg: 30,
      startDate,
    });
    expect(result.months).toBe(3);
    expect(result.projected?.weight).toBe(72.1);
    expect(result.projected?.mmKg).toBe(32.1);
    expect(result.projected?.bfKg).toBe(10.5);
    expect(result.projected?.bfPercentage).toBe(14.6);
    expect(result.projected?.mmPercentage).toBe(44.5);
  });

  it('con IMC <= 20 en definición no proyecta (months 0) y usa el período estándar', () => {
    const result = calculateProjection({
      goal: 'definicion',
      weight: 55,
      height: 170,
      gender: 'F',
      startDate,
    });
    expect(result.months).toBe(0);
    expect(result.projected).toBeNull();
    expect(result.endDate.toISOString().slice(0, 10)).toBe('2026-04-15');
  });

  it('en mantención no proyecta cambio de peso y termina en 3 meses', () => {
    const result = calculateProjection({
      goal: 'mantencion',
      weight: 70,
      height: 175,
      gender: 'M',
      startDate,
    });
    expect(result.months).toBe(3);
    expect(result.projected).toBeNull();
  });
});

describe('evaluateGoalFeasibility', () => {
  it('bajar de peso con IMC 20 o menor no es factible', () => {
    expect(
      evaluateGoalFeasibility({ goal: 'definicion', weight: 59, height: 172, gender: 'M' }),
    ).toEqual({ feasible: false });
  });

  it('bajar de peso con IMC que tras 1 mes quedaría bajo 20 no es factible', () => {
    // 60 kg / 172 cm = IMC 20,3; -2 kg -> 19,6
    expect(
      evaluateGoalFeasibility({ goal: 'definicion', weight: 60, height: 172, gender: 'M' }),
    ).toEqual({ feasible: false });
  });

  it('bajar de peso con IMC saludable es factible', () => {
    expect(
      evaluateGoalFeasibility({ goal: 'definicion', weight: 80, height: 172, gender: 'M' }),
    ).toEqual({ feasible: true });
  });

  it('volumen y mantención siempre son factibles', () => {
    expect(
      evaluateGoalFeasibility({ goal: 'volumen', weight: 50, height: 172, gender: 'M' }),
    ).toEqual({ feasible: true });
    expect(
      evaluateGoalFeasibility({ goal: 'mantencion', weight: 50, height: 172, gender: 'M' }),
    ).toEqual({ feasible: true });
  });
});

describe('findLatestBodyComposition', () => {
  it('toma la medición más reciente que tenga %GC o masa muscular', () => {
    expect(
      findLatestBodyComposition([
        { measurementResults: [{ bfPercentage: null, mmKg: null }] },
        { measurementResults: [{ bfPercentage: 22, mmKg: 30 }] },
        { measurementResults: [{ bfPercentage: 25, mmKg: 28 }] },
      ] as any),
    ).toEqual({ bfPercentage: 22, mmKg: 30 });
  });

  it('sin mediciones con composición corporal devuelve nulls', () => {
    expect(findLatestBodyComposition([{ measurementResults: [] }] as any)).toEqual({
      bfPercentage: null,
      mmKg: null,
    });
  });
});
