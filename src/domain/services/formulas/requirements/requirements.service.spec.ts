import {
  calculateMifflinBmr,
  calculateBodyMassIndex,
  calculateCarrascoBmr,
  calculateBmr,
  calculateTotalEnergyExpenditure,
  calculateRequirements,
} from './requirements.service';

describe('calculateMifflinBmr', () => {
  it('calcula BMR para un hombre adulto', () => {
    expect(calculateMifflinBmr(70, 175, 30, 'M')).toBeCloseTo(1648.75, 5);
  });

  it('calcula BMR para una mujer adulta', () => {
    expect(calculateMifflinBmr(70, 175, 30, 'F')).toBeCloseTo(1482.75, 5);
  });

  it('convierte la altura a centímetros si viene en metros (<10)', () => {
    expect(calculateMifflinBmr(70, 1.75, 30, 'M')).toBeCloseTo(1648.75, 5);
  });
});

describe('calculateBodyMassIndex', () => {
  it('calcula el IMC a partir de peso y altura en cm', () => {
    expect(calculateBodyMassIndex(70, 175)).toBeCloseTo(22.857142857142858, 10);
  });
});

describe('calculateCarrascoBmr', () => {
  it('hombre con IMC < 25 usa el factor 23.6', () => {
    expect(calculateCarrascoBmr(70, 175, 'M')).toBeCloseTo(1652, 5);
  });

  it('mujer con IMC < 25 usa el factor 20.7', () => {
    expect(calculateCarrascoBmr(70, 175, 'F')).toBeCloseTo(1449, 5);
  });

  it('hombre con IMC entre 25 y 30 usa el factor 20', () => {
    expect(calculateCarrascoBmr(90, 175, 'M')).toBeCloseTo(1800, 5);
  });
});

describe('calculateBmr', () => {
  it('adulto no deportista usa siempre Carrasco, sin importar el somatotipo', () => {
    const bmr = calculateBmr({
      weight: 70,
      height: 175,
      gender: 'M',
      age: 30,
      athlete: false,
      somatotype: 'ENDO',
    });
    expect(bmr).toBeCloseTo(1652, 5);
  });

  it('adulto deportista con IMC normopeso usa Mifflin, sin importar el somatotipo', () => {
    const bmr = calculateBmr({
      weight: 70,
      height: 175,
      gender: 'M',
      age: 30,
      athlete: true,
      somatotype: 'ENDO',
    });
    expect(bmr).toBeCloseTo(1648.75, 5);
  });

  it('adulto deportista con sobrepeso y somatotipo MESO usa Mifflin', () => {
    const bmr = calculateBmr({
      weight: 90,
      height: 175,
      gender: 'M',
      age: 30,
      athlete: true,
      somatotype: 'MESO',
    });
    expect(bmr).toBeCloseTo(1848.75, 5);
  });

  it('adulto deportista con sobrepeso y somatotipo MESOENDO promedia Carrasco y Mifflin', () => {
    const bmr = calculateBmr({
      weight: 90,
      height: 175,
      gender: 'M',
      age: 30,
      athlete: true,
      somatotype: 'MESOENDO',
    });
    expect(bmr).toBeCloseTo((1800 + 1848.75) / 2, 5);
  });

  it('adulto deportista con sobrepeso y otro somatotipo (ej ENDO) usa Carrasco', () => {
    const bmr = calculateBmr({
      weight: 90,
      height: 175,
      gender: 'M',
      age: 30,
      athlete: true,
      somatotype: 'ENDO',
    });
    expect(bmr).toBeCloseTo(1800, 5);
  });

  it('menor de 10 años usa la fórmula FAO/OMS/UNU correspondiente (hombre)', () => {
    const bmr = calculateBmr({
      weight: 30,
      height: 130,
      gender: 'M',
      age: 8,
      athlete: false,
      somatotype: '',
    });
    expect(bmr).toBeCloseTo(22.706 * 30 + 504.3, 5);
  });

  it('menor entre 10 y 18 años usa la fórmula FAO/OMS/UNU correspondiente (mujer)', () => {
    const bmr = calculateBmr({
      weight: 45,
      height: 155,
      gender: 'F',
      age: 14,
      athlete: false,
      somatotype: '',
    });
    expect(bmr).toBeCloseTo(13.384 * 45 + 692.6, 5);
  });
});

describe('calculateTotalEnergyExpenditure', () => {
  it('aplica el factor de actividad física y termogénesis, y redondea', () => {
    const tee = calculateTotalEnergyExpenditure({
      weight: 70,
      height: 175,
      gender: 'M',
      age: 30,
      physicalActivityLevel: 1.4,
      athlete: false,
      somatotype: '',
    });
    expect(tee).toBe(2478);
  });
});

describe('calculateRequirements', () => {
  const base = {
    weight: 70,
    height: 175,
    gender: 'M',
    age: 30,
    physicalActivityLevel: 1.4,
    athlete: false,
    somatotype: '',
  };

  it('goal "definicion" resta calorías según el rango de IMC', () => {
    const req = calculateRequirements({ ...base, goal: 'definicion' });
    expect(req.calories).toBeCloseTo(1978, 5);
    expect(req.protein).toBeCloseTo(112, 5);
    expect(req.carbohydrate).toBeCloseTo(271.975, 5);
    expect(req.fat).toBeCloseTo(49.12222222, 5);
  });

  it('goal "volumen" suma un superávit calórico basado en el peso', () => {
    const req = calculateRequirements({ ...base, goal: 'volumen' });
    expect(req.calories).toBeCloseTo(2723, 5);
    expect(req.protein).toBeCloseTo(112, 5);
    expect(req.carbohydrate).toBeCloseTo(340.375, 5);
    expect(req.fat).toBeCloseTo(101.5, 5);
  });

  it('goal "mantencion" (u otro valor) usa el gasto energético total sin ajuste', () => {
    const req = calculateRequirements({ ...base, goal: 'mantencion' });
    expect(req.calories).toBeCloseTo(2478, 5);
    expect(req.protein).toBeCloseTo(112, 5);
    expect(req.carbohydrate).toBeCloseTo(309.75, 5);
    expect(req.fat).toBeCloseTo(87.88888888888889, 5);
  });

  it('todo macronutriente es consistente con calories = protein*4 + carbohydrate*4 + fat*9', () => {
    const req = calculateRequirements({ ...base, goal: 'definicion' });
    const recomposed = req.protein * 4 + req.carbohydrate * 4 + req.fat * 9;
    expect(recomposed).toBeCloseTo(req.calories, 5);
  });
});
