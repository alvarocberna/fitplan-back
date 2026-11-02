import {
  correctedArmGirth,
  correctedCalfGirth,
  correctedThighGirth,
} from '../perimeters/corrected-girths.service';

type LeeMuscleMassKgType = {
  gender: string;
  decimalAge: number;
  height: number;
  correctedArm: number;
  correctedCalf: number;
  correctedThigh: number;
};

type MuscleMassPercentageType = {
  weight: number;
  muscleMassKg: number;
};

export function calculateLeeMuscleMassKg({
  gender,
  decimalAge,
  height,
  correctedArm,
  correctedCalf,
  correctedThigh,
}: LeeMuscleMassKgType): number {
  gender = gender[0].toUpperCase();
  let muscleMass = 0;
  if (gender === 'M') {
    muscleMass =
      (height / 100) * (0.00744 * correctedArm ** 2) +
      0.00088 * correctedThigh ** 2 +
      0.00441 * correctedCalf ** 2 +
      2.4 * 1 -
      0.048 * decimalAge +
      7.8;
  } else if (gender === 'F') {
    muscleMass =
      (height / 100) * (0.00744 * correctedArm ** 2) +
      0.00088 * correctedThigh ** 2 +
      0.00441 * correctedCalf ** 2 +
      2.4 * 0 -
      0.048 * decimalAge +
      7.8;
  }
  return muscleMass;
}

export function calculateMuscleMassPercentage({
  weight,
  muscleMassKg,
}: MuscleMassPercentageType): number {
  const muscleMassPercentage = (muscleMassKg * 100) / weight;
  return muscleMassPercentage;
}
