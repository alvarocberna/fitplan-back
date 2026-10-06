import { BmiClassification } from '../classifications.enum';
import { calculateBmi, getBmiClassification } from './bmi.service';

describe('calculateBmi', () => {
  it('calcula peso / talla² con la talla en cm', () => {
    expect(calculateBmi({ weight: 70, height: 175 })).toBeCloseTo(22.857, 3);
  });

  it('acepta la talla en metros', () => {
    expect(calculateBmi({ weight: 70, height: 1.75 })).toBeCloseTo(22.857, 3);
  });
});

describe('getBmiClassification', () => {
  it.each([
    [18.4, BmiClassification.UNDERWEIGHT],
    [18.5, BmiClassification.NORMAL_WEIGHT],
    [24.9, BmiClassification.NORMAL_WEIGHT],
    [25, BmiClassification.OVERWEIGHT],
    [29.9, BmiClassification.OVERWEIGHT],
    [30, BmiClassification.OBESITY_I],
    [34.9, BmiClassification.OBESITY_I],
    [35, BmiClassification.OBESITY_II],
    [39.9, BmiClassification.OBESITY_II],
    [40, BmiClassification.OBESITY_III],
    [55, BmiClassification.OBESITY_III],
  ])('IMC %p -> %p', (bmi, expected) => {
    expect(getBmiClassification(bmi)).toBe(expected);
  });
});
