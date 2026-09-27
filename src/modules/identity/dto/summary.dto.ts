// Solo los campos básicos del último plan nutricional (los de ingesta real, nunca los de
// requerimiento) — ver NutritionalPlanEntity en domain/entities/nutritional-plan.entity.ts.
export interface SummaryNutritionalPlanDto {
  dietRegimen: string | null;
  calorieIntake: number;
  proteinIntake: number;
  carbohydrateIntake: number;
  lipidIntake: number;
}

// Indicadores de la última medición del historial clínico (la de measuredAt más reciente, de una
// consulta o registrada por el usuario). bmi/bmiClassification/bfPercentage salen solo de
// measurement_results: si la medición no tiene resultados calculados quedan en null.
export interface SummaryLastMeasurementDto {
  measuredAt: string;
  weight: number | null;
  height: number | null;
  bmi: number | null;
  bmiClassification: string | null;
  bfPercentage: number | null;
}

export interface SummaryDto {
  firstName: string | null;
  middleName: string | null;
  paternalLastName: string | null;
  maternalLastName: string | null;
  age: number | null;
  // Fecha (ISO) de la última consulta con plan generado — misma consulta de la que salen
  // goal y nutritionalPlan.
  lastConsultationDate: string | null;
  goal: string | null;
  nutritionalPlan: SummaryNutritionalPlanDto | null;
  lastMeasurement: SummaryLastMeasurementDto | null;
}
