// Mapeos compartidos por GET /me/plans (CU-PLN-04) y GET /me/plans/:orderId (CU-PLN-05): de la orden
// (con product y plan -> nutritionalPlan principal) a los DTOs de "mis planes".

import { NutritionPlanDto } from '../../domain/dtos/nutrition-plan.dto';
import { NutritionalPlanTreeDto } from '../../domain/dtos/clinical-domain/plan/upsert-plan-with-main-nutritional-plan.dto';
import {
  PlanMealTimeNoteType,
  PlanSupplementNoteType,
  ProductType,
} from '../../domain/entities/enums';
import { NutritionalPlanEntity } from '../../domain/entities/nutritional-plan.entity';
import { OrderEntity } from '../../domain/entities/order.entity';
import { ProductEntity } from '../../domain/entities/product.entity';
import { mapPlanToNutritionalPlanDto } from './generation/plan-generation.mapper';
import {
  MealTimePortionGroup,
  MyGeneratedPlanDetailDto,
  MyPlanSummaryInfoDto,
} from './dto/my-plan.dto';

const PORTION_GROUPS: MealTimePortionGroup[] = [
  'cereal',
  'freeConsumptionVegetable',
  'generalConsumptionVegetable',
  'fruit',
  'highFatProtein',
  'lowFatProtein',
  'highFatDairy',
  'mediumFatDairy',
  'lowFatDairy',
  'highProteinDairy',
  'lipidRich',
  'oil',
  'sugar',
];

export function mainNutritionalPlanOf(
  order: OrderEntity,
): NutritionalPlanEntity | null {
  return order.plan?.nutritionalPlans?.[0] ?? null;
}

// Nombre visible del plan: el del NutritionalPlan si lo hay (personalizado), si no el del producto.
export function planNameOf(order: OrderEntity): string {
  return mainNutritionalPlanOf(order)?.planName ?? order.product?.name ?? 'Plan nutricional';
}

// payment_date es la fecha real de compra; las órdenes anteriores a registrarla caen a creation_date.
export function purchasedAtOf(order: OrderEntity): string {
  return (order.paymentDate ?? order.creationDate).toISOString();
}

// Resumen (objetivo, régimen, ingesta): desde el NutritionalPlan principal en los personalizados, y
// desde product en los estándar. null si no hay ningún dato que mostrar.
export function summaryOf(order: OrderEntity): MyPlanSummaryInfoDto | null {
  if (order.product?.type === ProductType.PREDEFINED) {
    return productSummaryOf(order.product);
  }
  const plan = mainNutritionalPlanOf(order);
  if (!plan) return null;
  return {
    goal: plan.goal,
    dietRegimen: plan.dietRegimen,
    calorieIntake: plan.calorieIntake,
    proteinIntake: plan.proteinIntake,
    carbohydrateIntake: plan.carbohydrateIntake,
    lipidIntake: plan.lipidIntake,
  };
}

export function productSummaryOf(
  product: Pick<
    ProductEntity,
    'goal' | 'dietRegimen' | 'calorieIntake' | 'proteinIntake' | 'carbohydrateIntake' | 'lipidIntake'
  >,
): MyPlanSummaryInfoDto | null {
  const summary = {
    goal: product.goal,
    dietRegimen: product.dietRegimen,
    calorieIntake: product.calorieIntake,
    proteinIntake: product.proteinIntake,
    carbohydrateIntake: product.carbohydrateIntake,
    lipidIntake: product.lipidIntake,
  };
  return Object.values(summary).every((value) => value == null) ? null : summary;
}

// Detalle del plan personalizado. Fuente principal: el NutritionalPlan con sus tablas hijas. Los planes
// generados antes de que se poblaran las hijas (sin backfill) caen a order.planJson, que se pasa por el
// mismo mapper que usa la generación (sin porciones numéricas: esas solo existen al generar).
export function generatedDetailOf(
  order: OrderEntity,
): MyGeneratedPlanDetailDto | null {
  const plan = mainNutritionalPlanOf(order);
  const consultationId = order.plan?.consultationId ?? null;

  if (plan && (plan.mealTimes?.length ?? 0) > 0) {
    return toGeneratedDetail(fromEntity(plan), consultationId);
  }

  const fromJson = treeFromPlanJson(order, plan?.planName ?? order.product?.name ?? null);
  if (fromJson) {
    // Si existe la fila NutritionalPlan, sus fechas/periodo son los reales; el JSON no los trae.
    return toGeneratedDetail(
      plan ? { ...fromJson, period: plan.period, startDate: plan.startDate, endDate: plan.endDate } : { ...fromJson, startDate: null },
      consultationId,
    );
  }

  // Sin hijas y sin JSON utilizable: al menos el resumen de la fila principal.
  return plan ? toGeneratedDetail(fromEntity(plan), consultationId) : null;
}

type PlanTree = Omit<NutritionalPlanTreeDto, 'startDate'> & {
  startDate: Date | null;
};

function fromEntity(plan: NutritionalPlanEntity): PlanTree {
  return {
    ...plan,
    mealTimes: (plan.mealTimes ?? []).map((mealTime) => ({
      ...mealTime,
      notes: mealTime.notes ?? [],
    })),
    supplements: (plan.supplements ?? []).map((supplement) => ({
      ...supplement,
      notes: supplement.notes ?? [],
    })),
    sportsRecommendations: plan.sportsRecommendations ?? [],
  };
}

function treeFromPlanJson(
  order: OrderEntity,
  planName: string | null,
): NutritionalPlanTreeDto | null {
  if (!order.planJson) return null;
  try {
    const plan = JSON.parse(order.planJson) as NutritionPlanDto;
    return mapPlanToNutritionalPlanDto(plan, planName, []);
  } catch {
    // planJson de una versión anterior del contrato: se muestra lo que haya en la fila principal.
    return null;
  }
}

function toGeneratedDetail(
  plan: PlanTree,
  consultationId: string | null,
): MyGeneratedPlanDetailDto {
  const notesOf = <T extends string>(
    notes: { note: string; type: T }[],
    type: T,
  ) => notes.filter((note) => note.type === type).map((note) => note.note);

  return {
    consultationId,
    planName: plan.planName,
    period: plan.period ?? null,
    startDate: plan.startDate ? plan.startDate.toISOString() : null,
    endDate: plan.endDate ? plan.endDate.toISOString() : null,
    goal: plan.goal,
    dietRegimen: plan.dietRegimen,
    requirements: {
      calories: plan.calorieRequirement,
      protein: plan.proteinRequirement,
      carbohydrate: plan.carbohydrateRequirement,
      fat: plan.lipidRequirement,
    },
    intake: {
      calories: plan.calorieIntake,
      protein: plan.proteinIntake,
      carbohydrate: plan.carbohydrateIntake,
      fat: plan.lipidIntake,
    },
    mealTimes: plan.mealTimes.map((mealTime) => ({
      time: mealTime.time,
      hour: mealTime.hour ?? null,
      intake: {
        calories: mealTime.calorieIntake,
        protein: mealTime.proteinIntake,
        carbohydrate: mealTime.carbohydrateIntake,
        fat: mealTime.fatIntake,
      },
      portions: Object.fromEntries(
        PORTION_GROUPS.filter((group) => mealTime[group]).map((group) => [group, mealTime[group] as number]),
      ),
      examples: notesOf(mealTime.notes, PlanMealTimeNoteType.EXAMPLE),
      comments: notesOf(mealTime.notes, PlanMealTimeNoteType.COMMENT),
      equivalences: notesOf(mealTime.notes, PlanMealTimeNoteType.EQUIVALENCE),
    })),
    supplements: plan.supplements.map((supplement) => ({
      supplement: supplement.supplement,
      requirement: supplement.requirement,
      doseInstructions: supplement.doseInstructions ?? null,
      intakeInstructions: supplement.intakeInstructions ?? null,
      intake: {
        calories: supplement.calorieIntake,
        protein: supplement.proteinIntake,
        carbohydrate: supplement.carbohydrateIntake,
        fat: supplement.fatIntake,
      },
      effects: notesOf(supplement.notes, PlanSupplementNoteType.EFFECT),
      considerations: notesOf(supplement.notes, PlanSupplementNoteType.CONSIDERATION),
    })),
    sportsRecommendations: plan.sportsRecommendations.map((recommendation) => ({
      session: recommendation.session ?? null,
      strategy: recommendation.strategy ?? null,
      preActivity: recommendation.preActivity ?? null,
      duringActivity: recommendation.duringActivity ?? null,
      postActivity: recommendation.postActivity ?? null,
    })),
  };
}
