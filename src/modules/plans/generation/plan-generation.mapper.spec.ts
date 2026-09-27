import { mapPlanToNutritionalPlanDto } from './plan-generation.mapper';
import { NutritionPlanDto } from '../../../domain/dtos/nutrition-plan.dto';

describe('mapPlanToNutritionalPlanDto', () => {
  const plan = {
    prescription: {
      regimen: 'Régimen hipocalórico hiperproteico.',
      goal: 'Bajar de peso',
      calories: 2000,
      protein: 150,
      carbohydrate: 200,
      fat: 60,
    },
    planIntake: {
      adequacy: { calories: 98, protein: 99, carbohydrate: 97, fat: 101 },
      totalIntake: { calories: 1960, protein: 148.5, carbohydrate: 194, fat: 60.6 },
    },
  } as unknown as NutritionPlanDto;

  it('mapea prescription a los campos *Requirement y planIntake.totalIntake a los *Intake (fat → lipid)', () => {
    const startDate = new Date('2026-09-25T00:00:00Z');
    const result = mapPlanToNutritionalPlanDto(plan, 'Plan personalizado', startDate);

    expect(result).toEqual({
      planName: 'Plan personalizado',
      period: null,
      mainPlan: true,
      startDate,
      endDate: null,
      goal: 'Bajar de peso',
      dietRegimen: 'Régimen hipocalórico hiperproteico.',
      calorieRequirement: 2000,
      proteinRequirement: 150,
      carbohydrateRequirement: 200,
      lipidRequirement: 60,
      calorieIntake: 1960,
      proteinIntake: 148.5,
      carbohydrateIntake: 194,
      lipidIntake: 60.6,
    });
  });

  it('usa la fecha actual como startDate por defecto y un planName por defecto si viene null', () => {
    const result = mapPlanToNutritionalPlanDto(plan, null);

    expect(result.planName).toBe('Plan Nutricional Personalizado');
    expect(result.startDate).toBeInstanceOf(Date);
  });
});
