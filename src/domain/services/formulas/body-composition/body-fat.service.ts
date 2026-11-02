import { EvaClassification } from '../classifications.enum';
import {
  calculateKgFromPercentage,
  calculatePercentageFromKg,
} from './mass-conversion.service';

type FaulknerType = {
  gender: string;
  skinfoldSum6: number;
};

type YuhaszType = {
  gender: string;
  skinfolds: {
    triceps: number;
    subscapular: number;
    suprailiac: number;
    abdominal: number;
  };
};

type BodyDensityType = {
  age: number;
  gender: string;
  skinfoldSum4: number;
};

type BodyFatKgType = {
  weight: number;
  bodyFatPercentage: number;
};

type BodyFatPercentageType = {
  weight: number;
  bodyFatKg: number;
};

type BodyFatClassificationType = {
  gender: string;
  age: number;
  bodyFatPercentage: number;
};

export function calculateFaulknerBodyFatPercentage({
  gender,
  skinfoldSum6,
}: FaulknerType): number {
  gender = gender[0].toUpperCase();
  let bodyFat = 0;
  if (gender === 'M') {
    bodyFat = 0.1051 * skinfoldSum6 + 2.58;
  } else if (gender === 'F') {
    bodyFat = 0.1548 * skinfoldSum6 + 3.58;
  }
  return bodyFat;
}

export function calculateYuhaszBodyFatPercentage({
  gender,
  skinfolds,
}: YuhaszType): number {
  gender = gender[0].toUpperCase();
  const { triceps, subscapular, suprailiac, abdominal } = skinfolds;
  let bodyFat = 0;
  if (gender === 'M') {
    bodyFat = 5.783 + (triceps + subscapular + suprailiac + abdominal) * 0.153;
  } else if (gender === 'F') {
    bodyFat = 7.9 + (triceps + subscapular + suprailiac + abdominal) * 0.213;
  }
  return bodyFat;
}

export function calculateSiriBodyFatPercentage(density: number): number {
  const bodyFat = (4.95 / density - 4.5) * 100;
  return bodyFat;
}

export function calculateBodyDensity({
  age,
  gender,
  skinfoldSum4,
}: BodyDensityType): number {
  gender = gender[0].toUpperCase();
  let density: number = 1;
  if (gender === 'M') {
    switch (true) {
      case age < 20:
        density = 1.162 - 0.063 * Math.log10(skinfoldSum4);
        break;
      case age < 30:
        density = 1.1631 - 0.0632 * Math.log10(skinfoldSum4);
        break;
      case age < 40:
        density = 1.1422 - 0.0544 * Math.log10(skinfoldSum4);
        break;
      case age < 50:
        density = 1.162 - 0.07 * Math.log10(skinfoldSum4);
        break;
      case age > 50:
        density = 1.1715 - 0.0779 * Math.log10(skinfoldSum4);
        break;
    }
  } else if (gender === 'F') {
    switch (true) {
      case age < 20:
        density = 1.1549 - 0.0678 * Math.log10(skinfoldSum4);
        break;
      case age < 30:
        density = 1.1599 - 0.0717 * Math.log10(skinfoldSum4);
        break;
      case age < 40:
        density = 1.1423 - 0.0632 * Math.log10(skinfoldSum4);
        break;
      case age < 50:
        density = 1.1333 - 0.0612 * Math.log10(skinfoldSum4);
        break;
      case age > 50:
        density = 1.1339 - 0.0645 * Math.log10(skinfoldSum4);
        break;
    }
  }
  return density;
}

export function calculateBodyFatKg({
  weight,
  bodyFatPercentage,
}: BodyFatKgType): number {
  return calculateKgFromPercentage({ weight, percentage: bodyFatPercentage });
}

export function calculateBodyFatPercentage({
  weight,
  bodyFatKg,
}: BodyFatPercentageType): number {
  return calculatePercentageFromKg({ weight, kg: bodyFatKg });
}

export function getBodyFatClassification({
  gender,
  age,
  bodyFatPercentage,
}: BodyFatClassificationType): EvaClassification {
  gender = gender[0].toUpperCase();
  let classification: EvaClassification = EvaClassification.MEDIUM;
  if (gender === 'M') {
    switch (true) {
      case age < 40:
        if (bodyFatPercentage < 8) {
          classification = EvaClassification.LOW;
        } else if (bodyFatPercentage < 20 && bodyFatPercentage >= 8) {
          classification = EvaClassification.MEDIUM;
        } else if (bodyFatPercentage < 25 && bodyFatPercentage >= 20) {
          classification = EvaClassification.HIGH;
        } else if (bodyFatPercentage >= 25) {
          classification = EvaClassification.VERY_HIGH;
        }
        break;
      case age < 60:
        if (bodyFatPercentage < 11) {
          classification = EvaClassification.LOW;
        } else if (bodyFatPercentage < 22 && bodyFatPercentage >= 11) {
          classification = EvaClassification.MEDIUM;
        } else if (bodyFatPercentage < 28 && bodyFatPercentage >= 22) {
          classification = EvaClassification.HIGH;
        } else if (bodyFatPercentage >= 28) {
          classification = EvaClassification.VERY_HIGH;
        }
        break;
      case age >= 60:
        if (bodyFatPercentage < 13) {
          classification = EvaClassification.LOW;
        } else if (bodyFatPercentage < 25 && bodyFatPercentage >= 13) {
          classification = EvaClassification.MEDIUM;
        } else if (bodyFatPercentage < 30 && bodyFatPercentage >= 25) {
          classification = EvaClassification.HIGH;
        } else if (bodyFatPercentage >= 30) {
          classification = EvaClassification.VERY_HIGH;
        }
        break;
    }
  } else if (gender === 'F') {
    switch (true) {
      case age < 40:
        if (bodyFatPercentage < 21) {
          classification = EvaClassification.LOW;
        } else if (bodyFatPercentage < 33 && bodyFatPercentage >= 21) {
          classification = EvaClassification.MEDIUM;
        } else if (bodyFatPercentage < 39 && bodyFatPercentage >= 33) {
          classification = EvaClassification.HIGH;
        } else if (bodyFatPercentage >= 39) {
          classification = EvaClassification.VERY_HIGH;
        }
        break;
      case age < 60:
        if (bodyFatPercentage < 23) {
          classification = EvaClassification.LOW;
        } else if (bodyFatPercentage < 35 && bodyFatPercentage >= 23) {
          classification = EvaClassification.MEDIUM;
        } else if (bodyFatPercentage < 40 && bodyFatPercentage >= 35) {
          classification = EvaClassification.HIGH;
        } else if (bodyFatPercentage >= 40) {
          classification = EvaClassification.VERY_HIGH;
        }
        break;
      case age >= 60:
        if (bodyFatPercentage < 24) {
          classification = EvaClassification.LOW;
        } else if (bodyFatPercentage < 36 && bodyFatPercentage >= 24) {
          classification = EvaClassification.MEDIUM;
        } else if (bodyFatPercentage < 42 && bodyFatPercentage >= 36) {
          classification = EvaClassification.HIGH;
        } else if (bodyFatPercentage >= 42) {
          classification = EvaClassification.VERY_HIGH;
        }
        break;
    }
  }
  return classification;
}
