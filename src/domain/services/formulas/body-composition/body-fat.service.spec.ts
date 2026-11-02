import { EvaClassification } from '../classifications.enum';
import { getBodyFatClassification } from './body-fat.service';

describe('getBodyFatClassification', () => {
  it('clasifica a un hombre de 40 a 59 años con su propio tramo, no con el de 60 o más', () => {
    // 12 %: MEDIUM en el tramo 40-59 (>= 11), LOW en el de 60+ (< 13).
    expect(
      getBodyFatClassification({
        gender: 'M',
        age: 45,
        bodyFatPercentage: 12,
      }),
    ).toBe(EvaClassification.MEDIUM);
  });

  it('clasifica a un hombre de 60 años o más con el tramo de 60+', () => {
    expect(
      getBodyFatClassification({
        gender: 'M',
        age: 65,
        bodyFatPercentage: 12,
      }),
    ).toBe(EvaClassification.LOW);
  });
});
