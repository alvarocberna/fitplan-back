import {
  IsString,
  IsNumber,
  IsOptional,
  IsEmail,
  IsNotEmpty,
  IsDateString,
  ValidateNested,
  IsArray,
  IsBoolean,
  MaxLength,
  ArrayMaxSize,
} from 'class-validator';
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

// Topes de entrada: estos campos terminan dentro de un prompt del modelo y en la base de datos, así
// que un texto sin límite es un vector de abuso de costo (tokens) y de relleno de prompt.
const FREE_TEXT_MAX = 2000;
const LIST_ITEM_MAX = 300;
const LIST_MAX_ITEMS = 50;

export class PersonalInfoDtoImpl implements PersonalInfoDto {
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  rut!: number | null;

  @IsString()
  @MaxLength(FREE_TEXT_MAX)
  @IsOptional()
  dvRut!: string | null;

  @IsString()
  @MaxLength(FREE_TEXT_MAX)
  @IsNotEmpty()
  firstName!: string | null;

  @IsString()
  @MaxLength(FREE_TEXT_MAX)
  @IsOptional()
  middleName!: string | null;

  @IsString()
  @MaxLength(FREE_TEXT_MAX)
  @IsNotEmpty()
  paternalLastName!: string | null;

  @IsString()
  @MaxLength(FREE_TEXT_MAX)
  @IsOptional()
  maternalLastName!: string | null;

  @IsString()
  @MaxLength(FREE_TEXT_MAX)
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
  @MaxLength(FREE_TEXT_MAX)
  @IsOptional()
  primaryGoal!: string | null;

  @IsString()
  @MaxLength(FREE_TEXT_MAX)
  @IsOptional()
  secondaryGoal!: string[] | null;
}

export class ClinicalAnamnesisDtoImpl implements ClinicalAnamnesisDto {
  @IsString()
  @MaxLength(FREE_TEXT_MAX)
  @IsOptional()
  pathology!: string | null;

  @IsString()
  @MaxLength(FREE_TEXT_MAX)
  @IsOptional()
  familyMedicalHistory!: string | null;

  @IsString()
  @MaxLength(FREE_TEXT_MAX)
  @IsOptional()
  allergies!: string | null;

  @IsString()
  @MaxLength(FREE_TEXT_MAX)
  @IsOptional()
  intolerances!: string | null;

  @IsString()
  @MaxLength(FREE_TEXT_MAX)
  @IsOptional()
  medications!: string | null;

  @IsString()
  @MaxLength(FREE_TEXT_MAX)
  @IsOptional()
  gastrointestinalHistory!: string | null;

  @IsString()
  @MaxLength(FREE_TEXT_MAX)
  @IsOptional()
  bowelMovements!: string | null;

  @IsString()
  @MaxLength(FREE_TEXT_MAX)
  @IsOptional()
  surgeries!: string | null;
}

export class MealDtoImpl implements Meal {
  @IsString()
  @MaxLength(FREE_TEXT_MAX)
  mealTime!: string | null;

  @IsString()
  @MaxLength(FREE_TEXT_MAX)
  @IsOptional()
  cereals!: string | null;

  @IsString()
  @MaxLength(FREE_TEXT_MAX)
  @IsOptional()
  freeConsumptionVegetable!: string | null;

  @IsString()
  @MaxLength(FREE_TEXT_MAX)
  @IsOptional()
  generalConsumptionVegetable!: string | null;

  @IsString()
  @MaxLength(FREE_TEXT_MAX)
  @IsOptional()
  fruit!: string | null;

  @IsString()
  @MaxLength(FREE_TEXT_MAX)
  @IsOptional()
  highFatProtein!: string | null;

  @IsString()
  @MaxLength(FREE_TEXT_MAX)
  @IsOptional()
  lowFatProtein!: string | null;

  @IsString()
  @MaxLength(FREE_TEXT_MAX)
  @IsOptional()
  highFatDairy!: string | null;

  @IsString()
  @MaxLength(FREE_TEXT_MAX)
  @IsOptional()
  mediumFatDairy!: string | null;

  @IsString()
  @MaxLength(FREE_TEXT_MAX)
  @IsOptional()
  lowFatDairy!: string | null;

  @IsString()
  @MaxLength(FREE_TEXT_MAX)
  @IsOptional()
  highProteinDairy!: string | null;

  @IsString()
  @MaxLength(FREE_TEXT_MAX)
  @IsOptional()
  highLipid!: string | null;

  @IsString()
  @MaxLength(FREE_TEXT_MAX)
  @IsOptional()
  oil!: string | null;

  @IsString()
  @MaxLength(FREE_TEXT_MAX)
  @IsOptional()
  sugar!: string | null;

  @IsString()
  @MaxLength(FREE_TEXT_MAX)
  @IsOptional()
  alcohol!: string | null;
}

export class SportsStrategyDtoImpl implements SportsStrategy {
  @IsArray()
  @IsString({ each: true })
  @MaxLength(LIST_ITEM_MAX, { each: true })
  @ArrayMaxSize(LIST_MAX_ITEMS)
  @IsOptional()
  supplement!: string[] | null;

  @IsArray()
  @IsString({ each: true })
  @MaxLength(LIST_ITEM_MAX, { each: true })
  @ArrayMaxSize(LIST_MAX_ITEMS)
  @IsOptional()
  hydration!: string[] | null;

  @IsString()
  @MaxLength(FREE_TEXT_MAX)
  @IsOptional()
  preActivityMeal!: string | null;

  @IsString()
  @MaxLength(FREE_TEXT_MAX)
  @IsOptional()
  duringActivityMeal!: string | null;

  @IsString()
  @MaxLength(FREE_TEXT_MAX)
  @IsOptional()
  postActivityMeal!: string | null;
}

export class FoodPreferenceGroupDtoImpl implements FoodPreferenceGroup {
  @IsString()
  @MaxLength(FREE_TEXT_MAX)
  group!: string;

  @IsArray()
  @IsString({ each: true })
  @MaxLength(LIST_ITEM_MAX, { each: true })
  @ArrayMaxSize(LIST_MAX_ITEMS)
  @IsOptional()
  frequentConsumption!: string[];

  @IsArray()
  @IsString({ each: true })
  @MaxLength(LIST_ITEM_MAX, { each: true })
  @ArrayMaxSize(LIST_MAX_ITEMS)
  @IsOptional()
  occasionalConsumption!: string[];

  @IsArray()
  @IsString({ each: true })
  @MaxLength(LIST_ITEM_MAX, { each: true })
  @ArrayMaxSize(LIST_MAX_ITEMS)
  @IsOptional()
  rareConsumption!: string[];

  @IsArray()
  @IsString({ each: true })
  @MaxLength(LIST_ITEM_MAX, { each: true })
  @ArrayMaxSize(LIST_MAX_ITEMS)
  @IsOptional()
  avoidedFoods!: string[];
}

export class DietaryAnamnesisDtoImpl implements DietaryAnamnesisDto {
  @ValidateNested({ each: true })
  @ArrayMaxSize(LIST_MAX_ITEMS)
  @Type(() => MealDtoImpl)
  @IsOptional()
  r24h!: MealDtoImpl[] | null;

  @ValidateNested({ each: true })
  @ArrayMaxSize(LIST_MAX_ITEMS)
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
  @MaxLength(FREE_TEXT_MAX)
  @IsOptional()
  description!: string | null;

  @IsString()
  @MaxLength(FREE_TEXT_MAX)
  @IsOptional()
  discipline!: string | null;

  @IsNumber()
  @IsOptional()
  duration!: number | null;

  @IsString()
  @MaxLength(FREE_TEXT_MAX)
  @IsOptional()
  intensity!: string | null;

  @IsString()
  @MaxLength(FREE_TEXT_MAX)
  @IsOptional()
  eventType!: string | null;

  @IsString()
  @MaxLength(FREE_TEXT_MAX)
  @IsOptional()
  days!: string | null;

  @IsString()
  @MaxLength(FREE_TEXT_MAX)
  @IsOptional()
  schedule!: string | null;
}

export class HealthyLifestyleDtoImpl implements HealthyLifestyleDto {
  @IsString()
  @MaxLength(FREE_TEXT_MAX)
  @IsOptional()
  alcohol!: string | null;

  @IsString()
  @MaxLength(FREE_TEXT_MAX)
  @IsOptional()
  tobacco!: string | null;

  @IsString()
  @MaxLength(FREE_TEXT_MAX)
  @IsOptional()
  physicalActivityLevel!: string | null;

  @IsArray()
  @IsString({ each: true })
  @MaxLength(LIST_ITEM_MAX, { each: true })
  @ArrayMaxSize(LIST_MAX_ITEMS)
  @IsOptional()
  sport!: string[] | null;

  @ValidateNested({ each: true })
  @ArrayMaxSize(LIST_MAX_ITEMS)
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
  @MaxLength(FREE_TEXT_MAX)
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
