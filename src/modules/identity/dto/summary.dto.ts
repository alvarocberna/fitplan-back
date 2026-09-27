// Solo los campos básicos del último plan nutricional (los de ingesta real, nunca los de
// requerimiento) — ver NutritionalPlanEntity en domain/entities/nutritional-plan.entity.ts.
export interface SummaryNutritionalPlanDto {
  dietRegimen: string | null;
  calorieIntake: number;
  proteinIntake: number;
  carbohydrateIntake: number;
  lipidIntake: number;
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
}
