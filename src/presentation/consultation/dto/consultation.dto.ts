import { IsString, IsNumber, IsInt, IsOptional, IsEmail, IsNotEmpty, IsDateString, ValidateNested, IsArray, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';
import {
  CompleteConsultationDto,
  PersonalInfoDto,
  ClinicalAnamnesisDto,
  DietaryAnamnesisDto,
  HealthyLifestyleDto,
  AnamnesisDto,
  MeasurementsDto,
  Meal,
  SportsStrategy,
  GoalsDto,
  FoodPreferenceGroup,
} from '../../../domain';

export class PersonalInfoDtoImpl implements PersonalInfoDto {

  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  rut!: number | null;

  @IsString()
  @IsOptional()
  dvRut!: string | null;

  @IsString()
  @IsNotEmpty()
  firstName!: string | null;

  @IsString()
  @IsOptional()
  middleName!: string | null;

  @IsString()
  @IsNotEmpty()
  paternalLastName!: string | null;

  @IsString()
  @IsOptional()
  maternalLastName!: string | null;


  @IsString()
  @IsNotEmpty()
  gender!: string | null;

  @IsBoolean()
  @IsNotEmpty()
  athlete!: boolean | null;

  @IsEmail()
  @IsOptional()
  email!: string | null;

  // @IsInt()
  // @IsOptional()
  // celular!: number | null;

  @IsDateString()
  @IsNotEmpty()
  dateOfBirth!: Date | null;
}

export class GoalsDtoImpl implements GoalsDto {
  @IsString()
  @IsOptional()
  primaryGoal!: string | null;

  @IsString()
  @IsOptional()
  secondaryGoal!: string[] | null;
}


export class ClinicalAnamnesisDtoImpl implements ClinicalAnamnesisDto {
  @IsString()
  @IsOptional()
  pathology!: string | null;

  @IsString()
  @IsOptional()
  familyMedicalHistory!: string | null;

  @IsString()
  @IsOptional()
  allergies!: string | null;

  @IsString()
  @IsOptional()
  intolerances!: string | null;

  @IsString()
  @IsOptional()
  medications!: string | null;

  @IsString()
  @IsOptional()
  gastrointestinalHistory!: string | null;

  @IsString()
  @IsOptional()
  bowelMovements!: string | null;

  @IsString()
  @IsOptional()
  surgeries!: string | null;
}

export class MealDtoImpl implements Meal {
  @IsString()
  mealTime!: string | null;

  @IsString()
  @IsOptional()
  cereals!: string | null;

  @IsString()
  @IsOptional()
  freeConsumptionVegetable!: string | null;

  @IsString()
  @IsOptional()
  generalConsumptionVegetable!: string | null;

  @IsString()
  @IsOptional()
  fruit!: string | null;

  @IsString()
  @IsOptional()
  highFatProtein!: string | null;

  @IsString()
  @IsOptional()
  lowFatProtein!: string | null;

  @IsString()
  @IsOptional()
  highFatDairy!: string | null;

  @IsString()
  @IsOptional()
  mediumFatDairy!: string | null;

  @IsString()
  @IsOptional()
  lowFatDairy!: string | null;

  @IsString()
  @IsOptional()
  highProteinDairy!: string | null;

  @IsString()
  @IsOptional()
  highLipid!: string | null;

  @IsString()
  @IsOptional()
  oil!: string | null;

  @IsString()
  @IsOptional()
  sugar!: string | null;

  @IsString()
  @IsOptional()
  alcohol!: string | null;
}

export class SportsStrategyDtoImpl implements SportsStrategy {
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  supplement!: string[] | null;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  hydration!: string[] | null;

  @IsString()
  @IsOptional()
  preActivityMeal!: string | null;

  @IsString()
  @IsOptional()
  duringActivityMeal!: string | null;

  @IsString()
  @IsOptional()
  postActivityMeal!: string | null;
}

export class FoodPreferenceGroupDtoImpl implements FoodPreferenceGroup {
  @IsString()
  group!: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  frequentConsumption!: string[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  occasionalConsumption!: string[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  rareConsumption!: string[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  avoidedFoods!: string[];
}

export class DietaryAnamnesisDtoImpl implements DietaryAnamnesisDto {
  @ValidateNested({ each: true })
  @Type(() => MealDtoImpl)
  @IsOptional()
  r24h!: MealDtoImpl[] | null;

  @ValidateNested({ each: true })
  @Type(() => FoodPreferenceGroupDtoImpl)
  @IsOptional()
  foodPreferenceGroups!: FoodPreferenceGroupDtoImpl[] | null;

  @ValidateNested()
  @Type(() => SportsStrategyDtoImpl)
  @IsOptional()
  sportsStrategy!: SportsStrategyDtoImpl;
}

export class SportSessionDtoImpl {
  @IsString()
  @IsOptional()
  description!: string | null;

  @IsString()
  @IsOptional()
  discipline!: string | null;

  @IsNumber()
  @IsOptional()
  duration!: number | null;

  @IsString()
  @IsOptional()
  intensity!: string | null;

  @IsString()
  @IsOptional()
  eventType!: string | null;

  @IsString()
  @IsOptional()
  days!: string | null;

  @IsString()
  @IsOptional()
  schedule!: string | null;
}

export class HealthyLifestyleDtoImpl implements HealthyLifestyleDto {
  @IsString()
  @IsOptional()
  alcohol!: string | null;

  @IsString()
  @IsOptional()
  tobacco!: string | null;

  @IsString()
  @IsOptional()
  physicalActivityLevel!: string | null;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  sport!: string[] | null;

  @ValidateNested({ each: true })
  @Type(() => SportSessionDtoImpl)
  @IsOptional()
  sportSession!: SportSessionDtoImpl[] | null;
}

export class AnamnesisDtoImpl implements AnamnesisDto {
  @ValidateNested()
  @Type(() => GoalsDtoImpl)
  @IsOptional()
  goals!: GoalsDtoImpl | null;

  @ValidateNested()
  @Type(() => ClinicalAnamnesisDtoImpl)
  @IsOptional()
  clinical!: ClinicalAnamnesisDtoImpl | null;

  @ValidateNested()
  @Type(() => DietaryAnamnesisDtoImpl)
  @IsOptional()
  dietary!: DietaryAnamnesisDtoImpl | null;

  @ValidateNested()
  @Type(() => HealthyLifestyleDtoImpl)
  @IsOptional()
  lifestyle!: HealthyLifestyleDtoImpl | null;
}

export class MeasurementsDtoImpl implements MeasurementsDto {
  @IsNumber()
  weight!: number | null;

  @IsNumber()
  height!: number | null;

  @IsString()
  @IsOptional()
  somatotype!: string | null;

  // @IsNumber()
  // sittingHeight!: number | null;

  // @IsNumber()
  // armSpan!: number | null;

  // @IsNumber()
  // triceps!: number | null;

  // @IsNumber()
  // subscapular!: number | null;

  // @IsNumber()
  // biceps!: number | null;

  // @IsNumber()
  // iliacCrest!: number | null;

  // @IsNumber()
  // supraspinal!: number | null;

  // @IsNumber()
  // abdominal!: number | null;

  // @IsNumber()
  // thigh!: number | null;

  // @IsNumber()
  // calfSkinfold!: number | null;

  // @IsNumber()
  // relaxedArm!: number | null;

  // @IsNumber()
  // flexedArm!: number | null;

  // @IsNumber()
  // waist!: number | null;

  // @IsNumber()
  // hip!: number | null;

  // @IsNumber()
  // midThigh!: number | null;

  // @IsNumber()
  // calfGirth!: number | null;

  // @IsNumber()
  // humerus!: number | null;

  // @IsNumber()
  // wristBreadth!: number | null;

  // @IsNumber()
  // femur!: number | null;
}

export class CompleteConsultationDtoImpl implements CompleteConsultationDto {
  @ValidateNested()
  @Type(() => PersonalInfoDtoImpl)
  personalInfo!: PersonalInfoDtoImpl | null;

  @ValidateNested()
  @Type(() => AnamnesisDtoImpl)
  anamnesis!: AnamnesisDtoImpl | null;

  @ValidateNested()
  @Type(() => MeasurementsDtoImpl)
  measurements!: MeasurementsDtoImpl | null;
}
