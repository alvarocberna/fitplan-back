import { mapPlanToNutritionalPlanDto } from './plan-generation.mapper';
import { NutritionPlanDto } from '../../domain/dtos/nutrition-plan.dto';

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
    const result = mapPlanToNutritionalPlanDto(plan, 'consultation-1', 'order-1');

    expect(result).toEqual({
      consultationId: 'consultation-1',
      orderId: 'order-1',
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
});
