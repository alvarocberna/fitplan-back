// Conversión entre kg y % del peso corporal de un componente (grasa, masa muscular, grasa visceral,
// masa ósea).

type KgFromPercentageType = {
  weight: number;
  percentage: number;
};

type PercentageFromKgType = {
  weight: number;
  kg: number;
};

export function calculateKgFromPercentage({
  weight,
  percentage,
}: KgFromPercentageType): number {
  const kg = (percentage * weight) / 100;
  return kg;
}

export function calculatePercentageFromKg({
  weight,
  kg,
}: PercentageFromKgType): number {
  const percentage = (kg * 100) / weight;
  return percentage;
}
