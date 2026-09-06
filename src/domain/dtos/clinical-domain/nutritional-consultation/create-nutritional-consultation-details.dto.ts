// Input para NutritionalConsultationDatasource.createNutritionalConsultationWithDetails: crea en
// una sola operación la NutritionalConsultation junto con todo el árbol Anamnesis+hijas y
// Measurements+hija (nested create de Prisma). Compone los Create*Dto ya existentes de cada
// entidad hija, omitiendo la FK hacia su padre inmediato (Prisma la resuelve sola en un nested
// create). Reemplaza al antiguo payloadJson: esto es lo que hoy arma OrdersService.createOrder a
// partir del CompleteConsultationDto recibido por POST /ordenes/crear.

import { CreateNutritionalConsultationDto } from './create-nutritional-consultation.dto';
import { CreateGoalsDto } from '../goals/create-goals.dto';
import { CreateAnamnesisClinicalDto } from '../anamnesis-clinical/create-anamnesis-clinical.dto';
import { CreateDietaryRecall24hMealDto } from '../dietary-recall-24h-meal/create-dietary-recall-24h-meal.dto';
import { CreateFoodPreferenceGroupDto } from '../food-preference-group/create-food-preference-group.dto';
import { CreateSportsSessionDto } from '../sports-session/create-sports-session.dto';
import { CreateSportsStrategyDto } from '../sports-strategy/create-sports-strategy.dto';
import { CreateBasicMeasurementsDto } from '../basic-measurements/create-basic-measurements.dto';

export interface AnamnesisDetailsInput {
  goals?: Omit<CreateGoalsDto, 'anamnesisId'>;
  clinical?: Omit<CreateAnamnesisClinicalDto, 'anamnesisId'>;
  dietary?: {
    dietType: string | null;
    r24hMeals: Omit<CreateDietaryRecall24hMealDto, 'dietaryRecall24hId'>[];
    foodPreferenceGroups: Omit<
      CreateFoodPreferenceGroupDto,
      'foodPreferenceId'
    >[];
  };
  lifestyle?: {
    tobacco: string | null;
    alcohol: string | null;
    physicalActivityLevel: string | null;
    sport: string[];
    sportsSessions: Omit<CreateSportsSessionDto, 'lifestyleId'>[];
    sportsStrategies: Omit<CreateSportsStrategyDto, 'lifestyleId'>[];
  };
}

export interface MeasurementsDetailsInput {
  measurementNumber: number;
  level: string | null;
  description: string | null;
  basicMeasurements?: Omit<CreateBasicMeasurementsDto, 'measurementsId'>;
}

export interface CreateNutritionalConsultationDetailsDto {
  consultation: CreateNutritionalConsultationDto;
  anamnesis: AnamnesisDetailsInput | null;
  measurements: MeasurementsDetailsInput | null;
}
