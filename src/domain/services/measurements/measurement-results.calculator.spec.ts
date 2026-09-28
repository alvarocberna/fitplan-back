import { MeasurementLevel } from '../../entities/enums';
import { calculateMeasurementResults } from './measurement-results.calculator';

describe('calculateMeasurementResults', () => {
  it('BASIC: solo IMC y su clasificación, redondeado a 2 decimales', () => {
    expect(
      calculateMeasurementResults({ level: MeasurementLevel.BASIC, weight: 70, height: 175 }),
    ).toEqual({ bmi: 22.86, bmiClassification: 'NORMAL_WEIGHT' });
  });

  it('sin peso o talla no calcula nada', () => {
    expect(
      calculateMeasurementResults({ level: MeasurementLevel.BASIC, weight: 70, height: null }),
    ).toEqual({});
  });

  it('BASIC ignora componentes de bioimpedancia', () => {
    const results = calculateMeasurementResults({
      level: MeasurementLevel.BASIC,
      weight: 70,
      height: 175,
      bodyFat: { value: 20, unit: 'PERCENTAGE' },
    });
    expect(results).not.toHaveProperty('bfPercentage');
  });

  it('BIOIMPEDANCE: completa kg desde % y % desde kg, con método BIOIMPEDANCE', () => {
    const results = calculateMeasurementResults({
      level: MeasurementLevel.BIOIMPEDANCE,
      weight: 80,
      height: 180,
      bodyFat: { value: 20, unit: 'PERCENTAGE' },
      muscleMass: { value: 36, unit: 'KG' },
    });
    expect(results).toEqual({
      bmi: 24.69,
      bmiClassification: 'NORMAL_WEIGHT',
      bfKg: 16,
      bfPercentage: 20,
      bfMethod: 'BIOIMPEDANCE',
      mmKg: 36,
      mmPercentage: 45,
      mmMethod: 'BIOIMPEDANCE',
      vfKg: null,
      vfPercentage: null,
      vfMethod: null,
      bmKg: null,
      bmPercentage: null,
      bmMethod: null,
    });
  });

  it('BIOIMPEDANCE: grasa visceral y masa ósea opcionales, redondeadas a 2 decimales', () => {
    const results = calculateMeasurementResults({
      level: MeasurementLevel.BIOIMPEDANCE,
      weight: 70,
      height: 175,
      bodyFat: { value: 14, unit: 'KG' },
      muscleMass: { value: 40, unit: 'PERCENTAGE' },
      visceralFat: { value: 2.3, unit: 'KG' },
      boneMass: { value: 4.1, unit: 'PERCENTAGE' },
    });
    expect(results).toMatchObject({
      vfKg: 2.3,
      vfPercentage: 3.29,
      vfMethod: 'BIOIMPEDANCE',
      bmKg: 2.87,
      bmPercentage: 4.1,
      bmMethod: 'BIOIMPEDANCE',
    });
    expect(results.vfClassification).toBeUndefined();
  });

  it('BIOIMPEDANCE sin grasa visceral ni masa ósea deja esas columnas en null', () => {
    const results = calculateMeasurementResults({
      level: MeasurementLevel.BIOIMPEDANCE,
      weight: 70,
      height: 175,
      bodyFat: { value: 20, unit: 'PERCENTAGE' },
      muscleMass: { value: 40, unit: 'PERCENTAGE' },
    });
    expect(results).toMatchObject({
      vfKg: null,
      vfPercentage: null,
      vfMethod: null,
      bmKg: null,
      bmPercentage: null,
      bmMethod: null,
    });
  });
});
