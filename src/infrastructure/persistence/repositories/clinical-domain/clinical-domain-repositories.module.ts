import { Module } from '@nestjs/common';
import { ClinicalDomainDatasourcesModule } from '../../datasources/clinical-domain/clinical-domain-datasources.module';

import { ClinicalRecordRepository } from '../../../../domain/repositories/clinical-domain/clinical-record.repository';
import { ClinicalRecordRepositoryImpl } from './clinical-record.repository';
import { NutritionalConsultationRepository } from '../../../../domain/repositories/clinical-domain/nutritional-consultation.repository';
import { NutritionalConsultationRepositoryImpl } from './nutritional-consultation.repository';
import { AnamnesisRepository } from '../../../../domain/repositories/clinical-domain/anamnesis.repository';
import { AnamnesisRepositoryImpl } from './anamnesis.repository';
import { GoalsRepository } from '../../../../domain/repositories/clinical-domain/goals.repository';
import { GoalsRepositoryImpl } from './goals.repository';
import { AnamnesisClinicalRepository } from '../../../../domain/repositories/clinical-domain/anamnesis-clinical.repository';
import { AnamnesisClinicalRepositoryImpl } from './anamnesis-clinical.repository';
import { ClinicalConditionRepository } from '../../../../domain/repositories/clinical-domain/clinical-condition.repository';
import { ClinicalConditionRepositoryImpl } from './clinical-condition.repository';
import { AnamnesisDietaryRepository } from '../../../../domain/repositories/clinical-domain/anamnesis-dietary.repository';
import { AnamnesisDietaryRepositoryImpl } from './anamnesis-dietary.repository';
import { DietaryRecall24hRepository } from '../../../../domain/repositories/clinical-domain/dietary-recall-24h.repository';
import { DietaryRecall24hRepositoryImpl } from './dietary-recall-24h.repository';
import { DietaryRecall24hMealRepository } from '../../../../domain/repositories/clinical-domain/dietary-recall-24h-meal.repository';
import { DietaryRecall24hMealRepositoryImpl } from './dietary-recall-24h-meal.repository';
import { FoodPreferenceRepository } from '../../../../domain/repositories/clinical-domain/food-preference.repository';
import { FoodPreferenceRepositoryImpl } from './food-preference.repository';
import { FoodPreferenceGroupRepository } from '../../../../domain/repositories/clinical-domain/food-preference-group.repository';
import { FoodPreferenceGroupRepositoryImpl } from './food-preference-group.repository';
import { SupplementsRepository } from '../../../../domain/repositories/clinical-domain/supplements.repository';
import { SupplementsRepositoryImpl } from './supplements.repository';
import { AnamnesisPsychosocialRepository } from '../../../../domain/repositories/clinical-domain/anamnesis-psychosocial.repository';
import { AnamnesisPsychosocialRepositoryImpl } from './anamnesis-psychosocial.repository';
import { LifestyleRepository } from '../../../../domain/repositories/clinical-domain/lifestyle.repository';
import { LifestyleRepositoryImpl } from './lifestyle.repository';
import { SportsSessionRepository } from '../../../../domain/repositories/clinical-domain/sports-session.repository';
import { SportsSessionRepositoryImpl } from './sports-session.repository';
import { SportsStrategyRepository } from '../../../../domain/repositories/clinical-domain/sports-strategy.repository';
import { SportsStrategyRepositoryImpl } from './sports-strategy.repository';
import { MeasurementsRepository } from '../../../../domain/repositories/clinical-domain/measurements.repository';
import { MeasurementsRepositoryImpl } from './measurements.repository';
import { BasicMeasurementsRepository } from '../../../../domain/repositories/clinical-domain/basic-measurements.repository';
import { BasicMeasurementsRepositoryImpl } from './basic-measurements.repository';
import { SkinfoldsRepository } from '../../../../domain/repositories/clinical-domain/skinfolds.repository';
import { SkinfoldsRepositoryImpl } from './skinfolds.repository';
import { CircumferencesRepository } from '../../../../domain/repositories/clinical-domain/circumferences.repository';
import { CircumferencesRepositoryImpl } from './circumferences.repository';
import { DiametersRepository } from '../../../../domain/repositories/clinical-domain/diameters.repository';
import { DiametersRepositoryImpl } from './diameters.repository';
import { MeasurementResultsRepository } from '../../../../domain/repositories/clinical-domain/measurement-results.repository';
import { MeasurementResultsRepositoryImpl } from './measurement-results.repository';
import { NutritionalPlanRepository } from '../../../../domain/repositories/clinical-domain/nutritional-plan.repository';
import { NutritionalPlanRepositoryImpl } from './nutritional-plan.repository';
import { PlanRepository } from '../../../../domain/repositories/clinical-domain/plan.repository';
import { PlanRepositoryImpl } from './plan.repository';
import { ProjectionRepository } from '../../../../domain/repositories/clinical-domain/projection.repository';
import { ProjectionRepositoryImpl } from './projection.repository';
import { PlanMealTimeRepository } from '../../../../domain/repositories/clinical-domain/plan-meal-time.repository';
import { PlanMealTimeRepositoryImpl } from './plan-meal-time.repository';
import { PlanMealTimeNoteRepository } from '../../../../domain/repositories/clinical-domain/plan-meal-time-note.repository';
import { PlanMealTimeNoteRepositoryImpl } from './plan-meal-time-note.repository';
import { PlanSupplementRepository } from '../../../../domain/repositories/clinical-domain/plan-supplement.repository';
import { PlanSupplementRepositoryImpl } from './plan-supplement.repository';
import { PlanSupplementNoteRepository } from '../../../../domain/repositories/clinical-domain/plan-supplement-note.repository';
import { PlanSupplementNoteRepositoryImpl } from './plan-supplement-note.repository';
import { PlanSportsRecommendationRepository } from '../../../../domain/repositories/clinical-domain/plan-sports-recommendation.repository';
import { PlanSportsRecommendationRepositoryImpl } from './plan-sports-recommendation.repository';

// Ata cada clase abstracta de domain/repositories/clinical-domain a su implementación concreta, que
// a su vez delega en el datasource correspondiente (ver ClinicalDomainDatasourcesModule). Los
// módulos consumidores inyectan el token abstracto (ej. NutritionalConsultationRepository), nunca
// el *Impl.
@Module({
  imports: [ClinicalDomainDatasourcesModule],
  providers: [
    {
      provide: ClinicalRecordRepository,
      useClass: ClinicalRecordRepositoryImpl,
    },
    {
      provide: NutritionalConsultationRepository,
      useClass: NutritionalConsultationRepositoryImpl,
    },
    { provide: AnamnesisRepository, useClass: AnamnesisRepositoryImpl },
    { provide: GoalsRepository, useClass: GoalsRepositoryImpl },
    {
      provide: AnamnesisClinicalRepository,
      useClass: AnamnesisClinicalRepositoryImpl,
    },
    {
      provide: ClinicalConditionRepository,
      useClass: ClinicalConditionRepositoryImpl,
    },
    {
      provide: AnamnesisDietaryRepository,
      useClass: AnamnesisDietaryRepositoryImpl,
    },
    {
      provide: DietaryRecall24hRepository,
      useClass: DietaryRecall24hRepositoryImpl,
    },
    {
      provide: DietaryRecall24hMealRepository,
      useClass: DietaryRecall24hMealRepositoryImpl,
    },
    {
      provide: FoodPreferenceRepository,
      useClass: FoodPreferenceRepositoryImpl,
    },
    {
      provide: FoodPreferenceGroupRepository,
      useClass: FoodPreferenceGroupRepositoryImpl,
    },
    { provide: SupplementsRepository, useClass: SupplementsRepositoryImpl },
    {
      provide: AnamnesisPsychosocialRepository,
      useClass: AnamnesisPsychosocialRepositoryImpl,
    },
    { provide: LifestyleRepository, useClass: LifestyleRepositoryImpl },
    { provide: SportsSessionRepository, useClass: SportsSessionRepositoryImpl },
    {
      provide: SportsStrategyRepository,
      useClass: SportsStrategyRepositoryImpl,
    },
    { provide: MeasurementsRepository, useClass: MeasurementsRepositoryImpl },
    {
      provide: BasicMeasurementsRepository,
      useClass: BasicMeasurementsRepositoryImpl,
    },
    { provide: SkinfoldsRepository, useClass: SkinfoldsRepositoryImpl },
    {
      provide: CircumferencesRepository,
      useClass: CircumferencesRepositoryImpl,
    },
    { provide: DiametersRepository, useClass: DiametersRepositoryImpl },
    {
      provide: MeasurementResultsRepository,
      useClass: MeasurementResultsRepositoryImpl,
    },
    {
      provide: NutritionalPlanRepository,
      useClass: NutritionalPlanRepositoryImpl,
    },
    {
      provide: PlanRepository,
      useClass: PlanRepositoryImpl,
    },
    {
      provide: ProjectionRepository,
      useClass: ProjectionRepositoryImpl,
    },
    { provide: PlanMealTimeRepository, useClass: PlanMealTimeRepositoryImpl },
    {
      provide: PlanMealTimeNoteRepository,
      useClass: PlanMealTimeNoteRepositoryImpl,
    },
    {
      provide: PlanSupplementRepository,
      useClass: PlanSupplementRepositoryImpl,
    },
    {
      provide: PlanSupplementNoteRepository,
      useClass: PlanSupplementNoteRepositoryImpl,
    },
    {
      provide: PlanSportsRecommendationRepository,
      useClass: PlanSportsRecommendationRepositoryImpl,
    },
  ],
  exports: [
    ClinicalRecordRepository,
    NutritionalConsultationRepository,
    AnamnesisRepository,
    GoalsRepository,
    AnamnesisClinicalRepository,
    ClinicalConditionRepository,
    AnamnesisDietaryRepository,
    DietaryRecall24hRepository,
    DietaryRecall24hMealRepository,
    FoodPreferenceRepository,
    FoodPreferenceGroupRepository,
    SupplementsRepository,
    AnamnesisPsychosocialRepository,
    LifestyleRepository,
    SportsSessionRepository,
    SportsStrategyRepository,
    MeasurementsRepository,
    BasicMeasurementsRepository,
    SkinfoldsRepository,
    CircumferencesRepository,
    DiametersRepository,
    MeasurementResultsRepository,
    NutritionalPlanRepository,
    PlanRepository,
    ProjectionRepository,
    PlanMealTimeRepository,
    PlanMealTimeNoteRepository,
    PlanSupplementRepository,
    PlanSupplementNoteRepository,
    PlanSportsRecommendationRepository,
  ],
})
export class ClinicalDomainRepositoriesModule {}
