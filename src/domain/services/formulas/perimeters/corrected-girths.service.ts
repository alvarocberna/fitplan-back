type CorrectedArmGirthType = {
  armGirth: number;
  tricepsSkinfold: number;
};

type CorrectedThighGirthType = {
  thighGirth: number;
  thighSkinfold: number;
};

type CorrectedCalfGirthType = {
  calfGirth: number;
  calfSkinfold: number;
};

export function correctedArmGirth({
  armGirth,
  tricepsSkinfold,
}: CorrectedArmGirthType): number {
  const correctedArm = armGirth - (tricepsSkinfold / 10) * Math.PI;
  return correctedArm;
}

export function correctedThighGirth({
  thighGirth,
  thighSkinfold,
}: CorrectedThighGirthType): number {
  const correctedThigh = thighGirth - (thighSkinfold / 10) * Math.PI;
  return correctedThigh;
}

export function correctedCalfGirth({
  calfGirth,
  calfSkinfold,
}: CorrectedCalfGirthType): number {
  const correctedCalf = calfGirth - (calfSkinfold / 10) * Math.PI;
  return correctedCalf;
}
