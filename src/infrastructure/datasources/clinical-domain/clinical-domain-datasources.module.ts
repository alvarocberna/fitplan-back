import { Module } from '@nestjs/common';

import { ClinicalRecordDatasource } from '../../../domain/datasources/clinical-domain/clinical-record.datasource';
import { ClinicalRecordDatasourceImpl } from './clinical-record.datasource';
import { NutritionalConsultationDatasource } from '../../../domain/datasources/clinical-domain/nutritional-consultation.datasource';
import { NutritionalConsultationDatasourceImpl } from './nutritional-consultation.datasource';
import { AnamnesisDatasource } from '../../../domain/datasources/clinical-domain/anamnesis.datasource';
import { AnamnesisDatasourceImpl } from './anamnesis.datasource';
import { GoalsDatasource } from '../../../domain/datasources/clinical-domain/goals.datasource';
import { GoalsDatasourceImpl } from './goals.datasource';
import { AnamnesisClinicalDatasource } from '../../../domain/datasources/clinical-domain/anamnesis-clinical.datasource';
import { AnamnesisClinicalDatasourceImpl } from './anamnesis-clinical.datasource';
import { ClinicalConditionDatasource } from '../../../domain/datasources/clinical-domain/clinical-condition.datasource';
import { ClinicalConditionDatasourceImpl } from './clinical-condition.datasource';
import { AnamnesisDietaryDatasource } from '../../../domain/datasources/clinical-domain/anamnesis-dietary.datasource';
import { AnamnesisDietaryDatasourceImpl } from './anamnesis-dietary.datasource';
import { DietaryRecall24hDatasource } from '../../../domain/datasources/clinical-domain/dietary-recall-24h.datasource';
import { DietaryRecall24hDatasourceImpl } from './dietary-recall-24h.datasource';
import { DietaryRecall24hMealDatasource } from '../../../domain/datasources/clinical-domain/dietary-recall-24h-meal.datasource';
import { DietaryRecall24hMealDatasourceImpl } from './dietary-recall-24h-meal.datasource';
import { FoodPreferenceDatasource } from '../../../domain/datasources/clinical-domain/food-preference.datasource';
import { FoodPreferenceDatasourceImpl } from './food-preference.datasource';
import { FoodPreferenceGroupDatasource } from '../../../domain/datasources/clinical-domain/food-preference-group.datasource';
import { FoodPreferenceGroupDatasourceImpl } from './food-preference-group.datasource';
import { SupplementsDatasource } from '../../../domain/datasources/clinical-domain/supplements.datasource';
import { SupplementsDatasourceImpl } from './supplements.datasource';
import { AnamnesisPsychosocialDatasource } from '../../../domain/datasources/clinical-domain/anamnesis-psychosocial.datasource';
import { AnamnesisPsychosocialDatasourceImpl } from './anamnesis-psychosocial.datasource';
import { LifestyleDatasource } from '../../../domain/datasources/clinical-domain/lifestyle.datasource';
import { LifestyleDatasourceImpl } from './lifestyle.datasource';
import { SportsSessionDatasource } from '../../../domain/datasources/clinical-domain/sports-session.datasource';
import { SportsSessionDatasourceImpl } from './sports-session.datasource';
import { SportsStrategyDatasource } from '../../../domain/datasources/clinical-domain/sports-strategy.datasource';
import { SportsStrategyDatasourceImpl } from './sports-strategy.datasource';
import { MeasurementsDatasource } from '../../../domain/datasources/clinical-domain/measurements.datasource';
import { MeasurementsDatasourceImpl } from './measurements.datasource';
import { BasicMeasurementsDatasource } from '../../../domain/datasources/clinical-domain/basic-measurements.datasource';
import { BasicMeasurementsDatasourceImpl } from './basic-measurements.datasource';
import { SkinfoldsDatasource } from '../../../domain/datasources/clinical-domain/skinfolds.datasource';
import { SkinfoldsDatasourceImpl } from './skinfolds.datasource';
import { CircumferencesDatasource } from '../../../domain/datasources/clinical-domain/circumferences.datasource';
import { CircumferencesDatasourceImpl } from './circumferences.datasource';
import { DiametersDatasource } from '../../../domain/datasources/clinical-domain/diameters.datasource';
import { DiametersDatasourceImpl } from './diameters.datasource';
import { MeasurementResultsDatasource } from '../../../domain/datasources/clinical-domain/measurement-results.datasource';
import { MeasurementResultsDatasourceImpl } from './measurement-results.datasource';
import { NutritionalPlanDatasource } from '../../../domain/datasources/clinical-domain/nutritional-plan.datasource';
import { NutritionalPlanDatasourceImpl } from './nutritional-plan.datasource';
import { PlanDatasource } from '../../../domain/datasources/clinical-domain/plan.datasource';
import { PlanDatasourceImpl } from './plan.datasource';
import { ProjectionDatasource } from '../../../domain/datasources/clinical-domain/projection.datasource';
import { ProjectionDatasourceImpl } from './projection.datasource';
import { PlanMealTimeDatasource } from '../../../domain/datasources/clinical-domain/plan-meal-time.datasource';
import { PlanMealTimeDatasourceImpl } from './plan-meal-time.datasource';
import { PlanMealTimeNoteDatasource } from '../../../domain/datasources/clinical-domain/plan-meal-time-note.datasource';
import { PlanMealTimeNoteDatasourceImpl } from './plan-meal-time-note.datasource';
import { PlanSupplementDatasource } from '../../../domain/datasources/clinical-domain/plan-supplement.datasource';
import { PlanSupplementDatasourceImpl } from './plan-supplement.datasource';
import { PlanSupplementNoteDatasource } from '../../../domain/datasources/clinical-domain/plan-supplement-note.datasource';
import { PlanSupplementNoteDatasourceImpl } from './plan-supplement-note.datasource';
import { PlanSportsRecommendationDatasource } from '../../../domain/datasources/clinical-domain/plan-sports-recommendation.datasource';
import { PlanSportsRecommendationDatasourceImpl } from './plan-sports-recommendation.datasource';

// Ata cada clase abstracta de domain/datasources/clinical-domain a su implementación concreta
// (Prisma). Los módulos consumidores inyectan el token abstracto (ej. NutritionalConsultationDatasource),
// nunca el *Impl, para no acoplarse a Prisma.
@Module({
  providers: [
    {
      provide: ClinicalRecordDatasource,
      useClass: ClinicalRecordDatasourceImpl,
    },
    {
      provide: NutritionalConsultationDatasource,
      useClass: NutritionalConsultationDatasourceImpl,
    },
    { provide: AnamnesisDatasource, useClass: AnamnesisDatasourceImpl },
    { provide: GoalsDatasource, useClass: GoalsDatasourceImpl },
    {
      provide: AnamnesisClinicalDatasource,
      useClass: AnamnesisClinicalDatasourceImpl,
    },
    {
      provide: ClinicalConditionDatasource,
      useClass: ClinicalConditionDatasourceImpl,
    },
    {
      provide: AnamnesisDietaryDatasource,
      useClass: AnamnesisDietaryDatasourceImpl,
    },
    {
      provide: DietaryRecall24hDatasource,
      useClass: DietaryRecall24hDatasourceImpl,
    },
    {
      provide: DietaryRecall24hMealDatasource,
      useClass: DietaryRecall24hMealDatasourceImpl,
    },
    {
      provide: FoodPreferenceDatasource,
      useClass: FoodPreferenceDatasourceImpl,
    },
    {
      provide: FoodPreferenceGroupDatasource,
      useClass: FoodPreferenceGroupDatasourceImpl,
    },
    { provide: SupplementsDatasource, useClass: SupplementsDatasourceImpl },
    {
      provide: AnamnesisPsychosocialDatasource,
      useClass: AnamnesisPsychosocialDatasourceImpl,
    },
    { provide: LifestyleDatasource, useClass: LifestyleDatasourceImpl },
    { provide: SportsSessionDatasource, useClass: SportsSessionDatasourceImpl },
    {
      provide: SportsStrategyDatasource,
      useClass: SportsStrategyDatasourceImpl,
    },
    { provide: MeasurementsDatasource, useClass: MeasurementsDatasourceImpl },
    {
      provide: BasicMeasurementsDatasource,
      useClass: BasicMeasurementsDatasourceImpl,
    },
    { provide: SkinfoldsDatasource, useClass: SkinfoldsDatasourceImpl },
    {
      provide: CircumferencesDatasource,
      useClass: CircumferencesDatasourceImpl,
    },
    { provide: DiametersDatasource, useClass: DiametersDatasourceImpl },
    {
      provide: MeasurementResultsDatasource,
      useClass: MeasurementResultsDatasourceImpl,
    },
    {
      provide: NutritionalPlanDatasource,
      useClass: NutritionalPlanDatasourceImpl,
    },
    {
      provide: PlanDatasource,
      useClass: PlanDatasourceImpl,
    },
    {
      provide: ProjectionDatasource,
      useClass: ProjectionDatasourceImpl,
    },
    { provide: PlanMealTimeDatasource, useClass: PlanMealTimeDatasourceImpl },
    {
      provide: PlanMealTimeNoteDatasource,
      useClass: PlanMealTimeNoteDatasourceImpl,
    },
    {
      provide: PlanSupplementDatasource,
      useClass: PlanSupplementDatasourceImpl,
    },
    {
      provide: PlanSupplementNoteDatasource,
      useClass: PlanSupplementNoteDatasourceImpl,
    },
    {
      provide: PlanSportsRecommendationDatasource,
      useClass: PlanSportsRecommendationDatasourceImpl,
    },
  ],
  exports: [
    ClinicalRecordDatasource,
    NutritionalConsultationDatasource,
    AnamnesisDatasource,
    GoalsDatasource,
    AnamnesisClinicalDatasource,
    ClinicalConditionDatasource,
    AnamnesisDietaryDatasource,
    DietaryRecall24hDatasource,
    DietaryRecall24hMealDatasource,
    FoodPreferenceDatasource,
    FoodPreferenceGroupDatasource,
    SupplementsDatasource,
    AnamnesisPsychosocialDatasource,
    LifestyleDatasource,
    SportsSessionDatasource,
    SportsStrategyDatasource,
    MeasurementsDatasource,
    BasicMeasurementsDatasource,
    SkinfoldsDatasource,
    CircumferencesDatasource,
    DiametersDatasource,
    MeasurementResultsDatasource,
    NutritionalPlanDatasource,
    PlanDatasource,
    ProjectionDatasource,
    PlanMealTimeDatasource,
    PlanMealTimeNoteDatasource,
    PlanSupplementDatasource,
    PlanSupplementNoteDatasource,
    PlanSportsRecommendationDatasource,
  ],
})
export class ClinicalDomainDatasourcesModule {}
