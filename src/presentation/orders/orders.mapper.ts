// Mapea el CompleteConsultationDto (shape de POST /ordenes/crear) hacia el input compuesto que
// espera NutritionalConsultationRepository.createNutritionalConsultationWithDetails. Reemplaza al
// antiguo JSON.stringify(dto) en payloadJson: acá es donde se resuelven las diferencias de forma
// entre el DTO del endpoint (que no cambia) y las entidades del nuevo schema.

import {
  AnamnesisDto,
  MeasurementsDto,
  Meal,
} from '../../domain/dtos/consultation.dto';
import { CreateDietaryRecall24hMealDto } from '../../domain/dtos/clinical-domain/dietary-recall-24h-meal/create-dietary-recall-24h-meal.dto';
import {
  AnamnesisDetailsInput,
  MeasurementsDetailsInput,
} from '../../domain/dtos/clinical-domain/nutritional-consultation/create-nutritional-consultation-details.dto';
import { SportsEventType } from '../../domain/entities/anamnesis.entity';

export function mapMealDtoToEntity(
  meal: Meal,
): Omit<CreateDietaryRecall24hMealDto, 'dietaryRecall24hId'> {
  return {
    mealTime: meal.mealTime ?? '',
    // Sin fuente en el DTO de consulta (no se recolecta la hora exacta de cada comida hoy).
    mealHour: '',
    // Tampoco se recolecta una descripción libre de la comida en el chat de consulta.
    description: '',
    carbohydrate: meal.carbohydrate ?? '',
    freeConsumptionVegetable: meal.freeConsumptionVegetable ?? '',
    generalConsumptionVegetable: meal.generalConsumptionVegetable ?? '',
    fruit: meal.fruit ?? '',
    highFatProtein: meal.highFatProtein ?? '',
    lowFatProtein: meal.lowFatProtein ?? '',
    highFatDairy: meal.highFatDairy ?? '',
    mediumFatDairy: meal.mediumFatDairy ?? '',
    lowFatDairy: meal.lowFatDairy ?? '',
    highProteinDairy: meal.highProteinDairy ?? '',
    lipidRich: meal.highLipid ?? '',
    oil: meal.oil ?? '',
    sugar: meal.sugar ?? '',
    alcohol: meal.alcohol ?? '',
  };
}

// SportsSession.eventType (entidad) exige 'TRAINING'|'COMPETITION'|null, pero el DTO de consulta
// solo captura texto libre (lo que haya tipeado/dictado el paciente en la entrevista). Heurística
// simple por substring; si no calza con ninguno de los dos, se guarda null en vez de forzar un
// valor incorrecto.
export function normalizeEventType(raw: string | null): SportsEventType | null {
  if (!raw) return null;
  const normalized = raw.toLowerCase();
  if (normalized.includes('compet')) return 'COMPETITION';
  if (normalized.includes('entrena') || normalized.includes('train'))
    return 'TRAINING';
  return null;
}

export function mapAnamnesisDtoToDetails(
  anamnesis: AnamnesisDto | null,
): AnamnesisDetailsInput | null {
  if (!anamnesis) return null;

  const clinical = anamnesis.clinical;
  const dietary = anamnesis.dietary;
  const lifestyle = anamnesis.lifestyle;

  return {
    goals: anamnesis.goals
      ? {
          mainGoal: anamnesis.goals.primaryGoal,
          secondaryGoal: anamnesis.goals.secondaryGoal ?? [],
        }
      : undefined,

    // El DTO trae cada campo clínico como un string único; la entidad los guarda como arrays
    // (pensados para múltiples patologías/alergias/etc. por paciente). Se envuelve el valor no
    // nulo en un array de 1 elemento — es una simplificación 1:1, no una lista real todavía.
    clinical: clinical
      ? {
          pathology: clinical.pathology ? [clinical.pathology] : [],
          familyHistory: clinical.familyMedicalHistory,
          allergy: clinical.allergies ? [clinical.allergies] : [],
          intolerance: clinical.intolerances ? [clinical.intolerances] : [],
          medication: clinical.medications ? [clinical.medications] : [],
          gastrointestinal: clinical.gastrointestinalHistory
            ? [clinical.gastrointestinalHistory]
            : [],
          surgery: clinical.surgeries ? [clinical.surgeries] : [],
          bowelMovement: clinical.bowelMovements,
          exams: null,
        }
      : undefined,

    dietary: dietary
      ? {
          dietType: null,
          r24hMeals: (dietary.r24h ?? []).map(mapMealDtoToEntity),
          foodPreferenceGroups: (dietary.foodPreferenceGroups ?? []).map(
            (group) => ({
              group: group.group,
              frequentConsumption: group.frequentConsumption,
              occasionalConsumption: group.occasionalConsumption,
              rareConsumption: group.rareConsumption,
              avoidedFoods: group.avoidedFoods,
            }),
          ),
        }
      : undefined,

    lifestyle: lifestyle
      ? {
          tobacco: lifestyle.tobacco,
          alcohol: lifestyle.alcohol,
          physicalActivityLevel: lifestyle.physicalActivityLevel,
          sport: lifestyle.sport ?? [],
          sportsSessions: (lifestyle.sportSession ?? []).map((session) => ({
            description: session.description,
            discipline: session.discipline,
            duration: session.duration,
            intensity: session.intensity,
            eventType: normalizeEventType(session.eventType),
            days: session.days,
            schedule: session.schedule,
          })),
          // dietary.sportsStrategy (DTO) mapea acá, a Lifestyle.sportsStrategies (entidad) — NO a
          // AnamnesisDietary. Es un cruce de ramas real entre el shape del DTO y el del schema;
          // no "corregir" moviéndolo a dietary sin revisar este comentario primero.
          sportsStrategies: dietary?.sportsStrategy
            ? [
                {
                  supplement:
                    dietary.sportsStrategy.supplement?.join(', ') || null,
                  hydration:
                    dietary.sportsStrategy.hydration?.join(', ') || null,
                  preActivityMeal: dietary.sportsStrategy.preActivityMeal,
                  duringActivityMeal: dietary.sportsStrategy.duringActivityMeal,
                  postActivityMeal: dietary.sportsStrategy.postActivityMeal,
                },
              ]
            : [],
        }
      : undefined,
  };
}

export function mapMeasurementsDtoToDetails(
  measurements: MeasurementsDto | null,
): MeasurementsDetailsInput | null {
  if (!measurements) return null;
  return {
    // Este flujo siempre crea una sola tanda de measurements por consulta.
    measurementNumber: 1,
    level: null,
    // El nuevo schema no tiene un campo dedicado para "somatotype"; se persiste como texto libre
    // acá (limitación documentada, ver doc/postgres-domain-groundwork.md).
    description: measurements.somatotype ?? null,
    basicMeasurements:
      measurements.weight != null && measurements.height != null
        ? {
            weight: measurements.weight,
            height: measurements.height,
            sittingHeight: null,
            armSpan: null,
          }
        : undefined,
  };
}
