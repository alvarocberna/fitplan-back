import { calculateSupplements } from './supplements.service';

describe('calculateSupplements', () => {
  it('calcula las 4 prescripciones para un peso de 70kg', () => {
    const result = calculateSupplements(70);

    expect(result.creatine.requirement).toBeCloseTo(2.5, 5);
    expect(result.creatine.dosageIndication).toContain('2.5 gr/día de creatina monohidratada');
    expect(result.creatine.intake).toEqual({ calories: 0, protein: 0, carbohydrate: 0, fat: 0 });

    expect(result.caffeine.requirement).toBe(105);
    expect(result.caffeine.dosageIndication).toContain('105 mg pre ejercicio');

    expect(result.nitrate.requirement).toBe(400);
    expect(result.nitrate.dosageIndication).toContain('400 mg pre ejercicio');

    expect(result.bicarbonate.requirement).toBeCloseTo(21, 5);
    expect(result.bicarbonate.dosageIndication).toContain('21 gr diluido en 700 ml');
    expect(result.bicarbonate.intakeIndication).toContain('comida con 105gr de carbo');
  });

  it('escala linealmente con el peso (creatina y cafeína dependen de weight)', () => {
    const lighter = calculateSupplements(50);
    const heavier = calculateSupplements(100);

    expect(heavier.creatine.requirement).toBeGreaterThan(lighter.creatine.requirement);
    expect(heavier.caffeine.requirement).toBeGreaterThan(lighter.caffeine.requirement);
    // el nitrato es una dosis fija, no depende del peso
    expect(lighter.nitrate.requirement).toBe(heavier.nitrate.requirement);
  });

  it('redondea la creatina al medio gramo más cercano hacia arriba', () => {
    // 60 * 0.03 = 1.8 -> *2 = 3.6 -> ceil = 4 -> /2 = 2
    expect(calculateSupplements(60).creatine.requirement).toBeCloseTo(2, 5);
  });

  it('elige el rango de carbohidratos correcto para la comida de bicarbonato según el peso', () => {
    // weight=40 -> carbohydrate = 60 <= 75 (única variante sin "r": "75g", no "75gr")
    expect(calculateSupplements(40).bicarbonate.intakeIndication).toContain('comida con 75g de carbo');
    // weight=100 -> carbohydrate = 150 <= 150
    expect(calculateSupplements(100).bicarbonate.intakeIndication).toContain('comida con 150gr de carbo');
    // weight=130 -> carbohydrate = 195 > 165 -> tope superior
    expect(calculateSupplements(130).bicarbonate.intakeIndication).toContain('comida con 180gr de carbo');
  });
});
