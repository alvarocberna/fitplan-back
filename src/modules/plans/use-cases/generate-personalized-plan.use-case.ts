//nest
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
//domain
import {
  CompleteConsultationDto,
  PersonalInfoDto,
  AnamnesisDto,
  MeasurementsDto,
} from '../../../domain/dtos/consultation.dto';
import {
  NutritionPlanDto,
  FoodWithEquivalence,
} from '../../../domain/dtos/nutrition-plan.dto';
import { OrderEntity } from '../../../domain/entities/order.entity';
import { UserEntity } from '../../../domain/entities/user.entity';
import { NutritionalConsultationEntity } from '../../../domain/entities/clinical-record.entity';
import { PlanRepository } from '../../../domain/repositories/clinical-domain/plan.repository';
import { NutritionalConsultationRepository } from '../../../domain/repositories/clinical-domain/nutritional-consultation.repository';
import { MeasurementsRepository } from '../../../domain/repositories/clinical-domain/measurements.repository';
import { UpsertPlanWithMainNutritionalPlanDto } from '../../../domain/dtos/clinical-domain/plan/upsert-plan-with-main-nutritional-plan.dto';
import { AnamnesisEntity } from '../../../domain/entities/anamnesis.entity';
import { MeasurementsEntity } from '../../../domain/entities/measurements.entity';
import { calculateAge } from '../../../domain/services/utils/age.service';
import {
  calculateProjection,
  findLatestBodyComposition,
} from '../../../domain/services/projection/projection.service';
import { calculateRequirements } from '../../../domain/services/formulas/requirements/requirements.service';
import {
  calculateSupplements,
  SupplementPrescription,
} from '../../../domain/services/formulas/requirements/supplements.service';
import { determineMealTimes } from '../../../domain/services/alimentos/meal-times.service';
import {
  defineFoodGroups,
  calculateFoodsAndIntake,
  calculateTotalPlanIntake,
  calculateTotalAdequacy,
  CalculatedMealTime,
  NumericMealTimePortions,
} from '../../../domain/services/alimentos/portion-adequacy.service';
import {
  FOOD_FIELD_TO_GROUP,
  FOOD_GROUP_PORTIONS,
} from '../../../domain/services/alimentos/food-portions';
//domain - puertos
import {
  AlertNotifier,
  EmailSender,
  FileStorage,
  LlmProvider,
  PlanDocumentRenderer,
} from '../../../domain/ports';
import { MAX_GENERATION_ROUNDS } from '../../../domain/services/orders/generation-retry.policy';
import {
  buildPersonalizedPlanKey,
  buildPlanThumbnailKey,
} from '../../../domain/services/utils/storage-keys';
//billing
import { OrderLifecycleService } from '../../billing/order-lifecycle.service';
//plans - generación
import {
  buildExtractInfoPromptUserMessage,
  buildUserPrompt,
  EXTRACT_INFO_SYSTEM_PROMPT,
  NUTRITIONIST_SYSTEM_PROMPT,
} from '../generation/plan-generation.prompts';
import { mapPlanToNutritionalPlanDto } from '../generation/plan-generation.mapper';

const MAX_ATTEMPTS = 4;
const BACKOFF_BASE_MS = 1000;

// La generación del plan corre cuando el usuario ya pagó: acá la precisión del
// resultado (aritmética de porciones, criterio clínico) pesa más que el costo por request, por eso usa
// un modelo más capaz que el del chat de anamnesis (ver OPENAI_MODEL_CONSULTA en chat-anamnesis.use-case.ts).
// Configurable vía env var sin necesidad de redeploy.
// NOTA: no se fija "temperature" acá porque gpt-5-mini solo soporta su valor default (1) -la API
// devuelve 400 ("Unsupported value: 'temperature'...") si se envía cualquier otro valor-.
const OPENAI_MODEL_PLAN = process.env.OPENAI_MODEL_PLAN ?? 'gpt-5-mini';

// Tolerancia (en porciones) al comparar lo que la IA reporta en "components" contra las porciones
// exactas ya calculadas por código: cubre solo errores de redondeo de punto flotante, no errores reales
// de escalamiento (ver validateGeneratedExamples).
const PORTION_TOLERANCE = 0.05;

// Desglose verificable de un ejemplo: por cada alimento que la IA usó en "text", declara a qué grupo
// pertenece, cuál es, y cuántos gramos le asignó. Permite validar en código que "text" respeta
// EXACTAMENTE las porciones calculadas, sin tener que parsear el texto libre (ver meal-times.prompt.ts).
type GeneratedExampleComponent = {
  field: string;
  food: string;
  weight: number;
};

type GeneratedExample = {
  text: string;
  components: GeneratedExampleComponent[];
};

// Una opción de "equivalences": un único alimento de un grupo, ya escalado a la cantidad de porciones
// que le corresponde a ese grupo (misma lógica que GeneratedExampleComponent, pero para un solo
// alimento en vez de una combinación).
type GeneratedEquivalenceOption = {
  text: string;
  food: string;
  weight: number;
};

type GeneratedEquivalenceGroup = {
  field: string;
  options: GeneratedEquivalenceOption[];
};

type GeneratedNutritionPlan = {
  prescription: {
    regimen: string;
    goal: string;
  };
  mealTimes: {
    hour: string | null;
    examples: GeneratedExample[];
    equivalences: GeneratedEquivalenceGroup[];
    comments: string[];
  }[];
  supplements: SupplementPrescription[];
  sportsRecommendations: NutritionPlanDto['sportsRecommendations'];
};

type ExtractedInfo = {
  physicalActivityLevel: number;
  goal: string;
};

type BaselineComposition = ReturnType<typeof findLatestBodyComposition>;

// Lanzado por implicitPortions()/validateGeneratedExamples()/validateGeneratedEquivalences() cuando
// la respuesta del LLM no calza con las porciones ya calculadas por código. Es una subclase de Error
// solo para poder distinguir en los logs de execute() un reintento por "la IA se equivocó en el
// escalamiento" de un reintento por otro motivo (timeout, rate limit, respuesta no-JSON, etc).
class PlanValidationError extends Error {}

@Injectable()
export class GeneratePersonalizedPlanUseCase {
  private readonly logger = new Logger(GeneratePersonalizedPlanUseCase.name);

  constructor(
    private readonly orderLifecycle: OrderLifecycleService,
    private readonly llm: LlmProvider,
    private readonly emailSender: EmailSender,
    private readonly alertNotifier: AlertNotifier,
    private readonly documentRenderer: PlanDocumentRenderer,
    private readonly fileStorage: FileStorage,
    private readonly planRepository: PlanRepository,
    private readonly nutritionalConsultationRepository: NutritionalConsultationRepository,
    private readonly measurementsRepository: MeasurementsRepository,
  ) {}

  //CU-PLN-06. Lo dispara (sin await, "fire and forget") OrderPaidListener cuando billing emite
  //order.paid para un producto GENERATED, y RetryPendingGenerationsUseCase (CU-PLN-08) cuando una
  //ronda anterior falló o quedó interrumpida. Cualquier error queda contenido acá adentro: nunca debe
  //tirar una unhandled rejection.
  async execute(input: { orderId: string }): Promise<void> {
    const { orderId } = input;
    //guard de estado: si la orden ya está GENERATING (otro disparo concurrente) o COMPLETED,
    //no hace nada. Solo entra si estaba NOT_STARTED o ERROR (reintento de un fallo previo).
    const canGenerate = await this.orderLifecycle.tryStartGeneration(orderId);
    if (!canGenerate) {
      this.logger.log(
        `Orden ${orderId}: generación ya en curso o completada, se ignora el disparo`,
      );
      return;
    }

    // La orden ya quedó en GENERATING: si falla la carga de sus datos, la ronda se da por fallida acá
    // mismo (en vez de dejarla pegada en GENERATING hasta que el job la libere 30 min después).
    let order: OrderEntity;
    let consultation: NutritionalConsultationEntity;
    let payload: CompleteConsultationDto;
    try {
      order = await this.orderLifecycle.findByIdWithUser(orderId);
      consultation = await this.getConsultationForOrder(orderId);
      payload = this.buildCompleteConsultationDto(order, consultation);
    } catch (error) {
      this.logger.error(
        `Orden ${orderId}: no se pudieron cargar los datos para generar el plan ` +
          `(${(error as Error).message})`,
        (error as Error).stack,
      );
      await this.failRound(orderId, error as Error, null);
      return;
    }
    const baseline = await this.getBaselineComposition(order.userId);

    const totalStart = Date.now();
    let validationRejections = 0;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      const attemptStart = Date.now();
      try {
        const { plan, numericPortions, goal } = await this.processPlan(payload);
        const attemptDurationMs = Date.now() - attemptStart;
        this.logger.log(
          `Orden ${orderId}: intento ${attempt}/${MAX_ATTEMPTS} generado en ${attemptDurationMs}ms`,
        );

        // El PDF se genera UNA sola vez acá (backend), se sube a S3, y el mismo buffer se
        // reutiliza para el adjunto del correo — evita regenerarlo tanto en el frontend como
        // una segunda vez dentro de EmailSender.
        const pdfBuffer = await this.documentRenderer.renderPdf(plan);
        const pdfKey = buildPersonalizedPlanKey(orderId);
        await this.fileStorage.uploadPdf(pdfBuffer, pdfKey);
        const thumbnailKey = await this.tryUploadThumbnail(orderId, pdfBuffer);

        // Se persiste el Plan (con su NutritionalPlan principal y todas sus tablas hijas) ANTES de
        // marcar la orden como COMPLETED, así una orden completada siempre tiene su plan normalizado.
        // Es un upsert por orderId, por lo que un reintento del loop no duplica ni rompe el @unique:
        // reemplaza el NutritionalPlan principal, sus hijos y la proyección (que define también el
        // end_date del plan).
        await this.planRepository.upsertPlanWithMainNutritionalPlanByOrderId({
          consultationId: consultation.id,
          orderId,
          ...this.buildPlanWithProjection(
            plan,
            order.product?.name ?? null,
            numericPortions,
            goal,
            payload,
            baseline,
          ),
        });

        await this.orderLifecycle.completeGeneration(
          orderId,
          plan,
          pdfKey,
          thumbnailKey,
        );
        const totalDurationMs = Date.now() - totalStart;
        this.logger.log(
          `Orden ${orderId}: plan generado con éxito (intento ${attempt}/${MAX_ATTEMPTS}, ` +
            `${validationRejections} rechazado(s) por validación, ${totalDurationMs}ms totales)`,
        );

        // El correo va FUERA del intento: la orden ya está COMPLETED y el plan disponible en el
        // panel, así que un fallo acá no debe volver a generar el plan ni marcar la orden en ERROR.
        await this.sendPlanEmail(order, plan, pdfBuffer);
        return;
      } catch (error) {
        const attemptDurationMs = Date.now() - attemptStart;
        const isValidationError = error instanceof PlanValidationError;
        if (isValidationError) validationRejections++;

        const isLastAttempt = attempt === MAX_ATTEMPTS;
        this.logger.warn(
          `Orden ${orderId}: falló el intento ${attempt}/${MAX_ATTEMPTS} en ${attemptDurationMs}ms` +
            `${isValidationError ? ' (rechazado por validación de ejemplos/equivalencias)' : ''} ` +
            `(${(error as Error).message})`,
        );

        if (isLastAttempt) {
          const totalDurationMs = Date.now() - totalStart;
          this.logger.error(
            `Orden ${orderId}: se agotaron los ${MAX_ATTEMPTS} intentos (${validationRejections} ` +
              `rechazado(s) por validación), ${totalDurationMs}ms totales`,
            (error as Error).stack,
          );
          await this.failRound(orderId, error as Error, order.attempts ?? 0);
          return;
        }

        await this.sleep(BACKOFF_BASE_MS * 2 ** (attempt - 1));
      }
    }
  }

  //helper de execute() - cierra una ronda fallida: la orden queda en ERROR con attempts + 1 (el job de
  //reintentos la retoma si le quedan rondas) y se avisa. Nunca lanza: si ni siquiera se puede
  //registrar el fallo, la orden queda en GENERATING y la libera el job (releaseStalledGenerations).
  private async failRound(
    orderId: string,
    error: Error,
    previousAttempts: number | null,
  ): Promise<void> {
    try {
      await this.orderLifecycle.recordFailedAttempt(orderId);
    } catch (recordError) {
      this.logger.error(
        `Orden ${orderId}: no se pudo registrar la ronda fallida ` +
          `(${(recordError as Error).message})`,
        (recordError as Error).stack,
      );
    }
    await this.notifyGenerationFailure(orderId, error, previousAttempts);
  }

  //helper de execute() - envío del plan por correo, best-effort: el plan ya está entregado en el
  //panel, así que un fallo se registra (y se avisa) sin tocar el estado de la orden.
  private async sendPlanEmail(
    order: OrderEntity,
    plan: NutritionPlanDto,
    pdfBuffer: Buffer,
  ): Promise<void> {
    const userEmail = order.user?.email;
    if (!userEmail) {
      this.logger.warn(
        `Orden ${order.id}: el usuario no tiene email, el plan no se envía por correo`,
      );
      return;
    }
    try {
      await this.emailSender.sendPlanByEmail(userEmail, plan, pdfBuffer);
    } catch (error) {
      this.logger.warn(
        `Orden ${order.id}: el plan se generó pero no se pudo enviar por correo ` +
          `(${(error as Error).message})`,
      );
      await this.alertNotifier.notify({
        event: 'plan_email_failed',
        severity: 'warning',
        message: `Orden ${order.id}: el plan está listo pero el correo no se pudo enviar`,
        context: { orderId: order.id, error: (error as Error).message },
      });
    }
  }

  //CU-PLN-06 - proyección (doc/nutrition-plan/proyeccion.md) según el objetivo clasificado: fija el
  //end_date del NutritionalPlan y, si el objetivo implica cambio de peso, la fila de projection.
  private buildPlanWithProjection(
    plan: NutritionPlanDto,
    planName: string | null,
    numericPortions: NumericMealTimePortions[],
    goal: string,
    payload: CompleteConsultationDto,
    baseline: BaselineComposition,
  ): Pick<UpsertPlanWithMainNutritionalPlanDto, 'nutritionalPlan' | 'projection'> {
    const startDate = new Date();
    const { endDate, projected } = calculateProjection({
      goal,
      weight: payload.measurements?.weight!,
      height: payload.measurements?.height!,
      gender: payload.personalInfo?.gender ?? null,
      bfPercentage: baseline.bfPercentage,
      mmKg: baseline.mmKg,
      startDate,
    });
    return {
      nutritionalPlan: mapPlanToNutritionalPlanDto(
        plan,
        planName,
        numericPortions,
        startDate,
        endDate,
      ),
      projection: projected
        ? {
            projectedStartDate: startDate,
            projectedEndDate: endDate,
            projectedWeight: projected.weight,
            projectedBmi: projected.bmi,
            projectedBfKg: projected.bfKg,
            projectedBfPercentage: projected.bfPercentage,
            projectedMmKg: projected.mmKg,
            projectedMmPercentage: projected.mmPercentage,
          }
        : null,
    };
  }

  //helper de execute() - %GC y masa muscular de la medición más reciente que los tenga. Es
  //best-effort: sin ella (o si falla la lectura) se proyecta solo con peso e IMC.
  private async getBaselineComposition(
    userId: string,
  ): Promise<BaselineComposition> {
    try {
      return findLatestBodyComposition(
        await this.measurementsRepository.listMeasurementsByPatientId(userId),
      );
    } catch (error) {
      this.logger.warn(
        `No se pudo leer la composición corporal de base del usuario ${userId} ` +
          `(${(error as Error).message})`,
      );
      return { bfPercentage: null, mmKg: null };
    }
  }

  //miniatura (página 1 del PDF) para el panel del frontend. Es best-effort: cualquier fallo se
  //registra y devuelve null, porque no debe fallar el plan ya pagado ni consumir un reintento (que
  //volvería a llamar a OpenAI). Sin miniatura el frontend muestra un placeholder con el botón de descarga.
  private async tryUploadThumbnail(
    orderId: string,
    pdfBuffer: Buffer,
  ): Promise<string | null> {
    try {
      const thumbnail = await this.documentRenderer.renderThumbnail(pdfBuffer);
      const thumbnailKey = buildPlanThumbnailKey(orderId);
      await this.fileStorage.uploadImage(thumbnail, thumbnailKey);
      return thumbnailKey;
    } catch (error) {
      this.logger.warn(
        `Orden ${orderId}: no se pudo generar/subir la miniatura del plan, se continúa sin ella ` +
          `(${(error as Error).message})`,
      );
      return null;
    }
  }

  //fuente de verdad para la generación: la consulta enlazada a la orden por
  //nutritional_consultation.order_id (no un JSON guardado en la orden).
  private async getConsultationForOrder(
    orderId: string,
  ): Promise<NutritionalConsultationEntity> {
    const consultation =
      await this.nutritionalConsultationRepository.getNutritionalConsultationWithDetailsByOrderId(
        orderId,
      );
    if (!consultation)
      throw new NotFoundException(`No hay consulta asociada a la orden ${orderId}`);
    return consultation;
  }

  //recibe la info de consulta y devuelve el plan nutricional, más las porciones numéricas de cada
  //tiempo de comida (alineadas por índice con plan.mealTimes). Estas últimas no viajan en el plan
  //(que se serializa en order.plan_json con las porciones como texto): solo se usan para poblar las
  //columnas numéricas de plan_meal_time.
  private async processPlan(
    body: CompleteConsultationDto,
  ): Promise<{
    plan: NutritionPlanDto;
    numericPortions: NumericMealTimePortions[];
    goal: string;
  }> {
    //se extrae informacion del prompt: NAF y objetivo
    const { physicalActivityLevel, goal } = await this.extractInfoPrompt(body);
    //se extrae informacion del body
    const weight: number = body.measurements?.weight!;
    const height: number = body.measurements?.height!;
    const somatotype: string = body.measurements?.somatotype!;
    const gender: string = body.personalInfo?.gender?.charAt(0).toUpperCase()!;
    const dateOfBirth = body.personalInfo?.dateOfBirth!;
    const age = calculateAge(dateOfBirth);
    const athlete = body.personalInfo?.athlete!;

    //PASO 1 - cálculo de requerimientos nutricionales (paso 1 doc)
    const requirements = calculateRequirements({
      weight: weight,
      height: height,
      gender: gender,
      age: age,
      physicalActivityLevel: physicalActivityLevel,
      goal: goal,
      athlete: athlete,
      somatotype: somatotype,
    });

    //PASO 2 - prescripcion: lo ejecuta la IA en base al prompt NUTRITIONIST_SYSTEM_PROMPT

    //PASO 3.1 - definir tiempos de comida
    const finalMealTimes = determineMealTimes(
      body.anamnesis?.dietary?.r24h ?? null,
      goal,
    );
    //PASO 3.2 - definir grupos de alimentos base x tiempo
    const mealTimeGroups = defineFoodGroups(finalMealTimes);
    //PASO 3.3 - adecuación de porciones de alimentos
    const portionAdequacyResult = calculateFoodsAndIntake(
      mealTimeGroups,
      requirements,
    );
    const { calculatedMealTimes, supplementIntakeNote, supplementIntake } =
      portionAdequacyResult;
    //calculo aporte total y adecuacion (considerando porciones y suplementos)
    const totalIntake = calculateTotalPlanIntake(portionAdequacyResult);
    const adequacy = calculateTotalAdequacy(totalIntake, requirements);

    //PASO 4 - generación de ejemplos y comentarios: lo ejecuta la IA en base al prompt NUTRITIONIST_SYSTEM_PROMPT

    //PASO 5 - calculo suplementos deportivos. se calculan, pero aún no se prrescriben (eso lo decide la IA)
    const supplementsPrescription = calculateSupplements(weight);

    //PASO 6 - recomendaciones deportivas: la IA decide cuales prescribe en base al prompt NUTRITIONIST_SYSTEM_PROMPT

    //generación de plan - codigo + IA
    const generated = await this.llm.chatJson<GeneratedNutritionPlan>(
      NUTRITIONIST_SYSTEM_PROMPT,
      [
        {
          role: 'user',
          content: buildUserPrompt(
            body,
            requirements,
            goal,
            supplementsPrescription,
            calculatedMealTimes,
            supplementIntakeNote,
            supplementIntake,
          ),
        },
      ],
      OPENAI_MODEL_PLAN,
    );

    // si los "examples"/"equivalences" que devolvió la IA no calzan con las porciones ya calculadas
    // por código, se lanza un error acá: lo captura el loop de reintentos de execute() (con
    // backoff), que vuelve a llamar a processPlan() y a pedirle el plan completo a la IA desde cero.
    this.validateGeneratedExamples(calculatedMealTimes, generated.mealTimes);
    this.validateGeneratedEquivalences(
      calculatedMealTimes,
      generated.mealTimes,
    );

    //merge: "foods" (porción calculada por código + equivalencia redactada por la IA) e "intake"
    //vienen del cálculo por código; "hour", "examples" y "comments" vienen de la IA, alineados por
    //índice con calculatedMealTimes.
    const mealTimes = calculatedMealTimes.map((calculated, index) => {
      const generatedMealTime = generated.mealTimes[index];
      const equivalenceByField = new Map(
        (generatedMealTime?.equivalences ?? []).map((group) => [
          group.field,
          group.options.map((option) => option.text).join(', '),
        ]),
      );

      const foods = Object.fromEntries(
        Object.entries(calculated.foods).map(([field, portion]) => [
          field,
          portion === null
            ? null
            : ({
                portion,
                equivalence: equivalenceByField.get(field) ?? '',
              } as FoodWithEquivalence),
        ]),
      ) as NutritionPlanDto['mealTimes'][number]['foods'];

      return {
        description: {
          time: calculated.mealTimeType,
          hour: generatedMealTime?.hour ?? null,
        },
        intake: calculated.intake,
        foods,
        examples:
          generatedMealTime?.examples.map((example) => example.text) ?? [],
        comments: generatedMealTime?.comments ?? [],
      };
    });

    //return
    const plan: NutritionPlanDto = {
      personalInfo: this.buildPersonalInfo(body),
      prescription: {
        regimen: generated.prescription.regimen,
        goal: generated.prescription.goal,
        calories: requirements.calories,
        protein: requirements.protein,
        carbohydrate: requirements.carbohydrate,
        fat: requirements.fat,
      },
      planIntake: { adequacy, totalIntake },
      mealTimes,
      supplements: generated.supplements,
      sportsRecommendations: generated.sportsRecommendations,
    };
    return {
      plan,
      numericPortions: calculatedMealTimes.map((calculated) => calculated.numericPortions),
      goal,
    };
  }

  //helper de processPlan() - extrae, formatea y construye un objeto con informacion personal
  private buildPersonalInfo(
    body: CompleteConsultationDto,
  ): NutritionPlanDto['personalInfo'] {
    const info = body.personalInfo;

    const name = [info?.firstName, info?.middleName].filter(Boolean).join(' ');
    const lastName = [info?.paternalLastName, info?.maternalLastName]
      .filter(Boolean)
      .join(' ');
    const age = info?.dateOfBirth ? String(calculateAge(info.dateOfBirth)) : '';

    return {
      name,
      lastName,
      age,
      date: new Date().toISOString().split('T')[0],
    };
  }

  // Reconstruye el shape CompleteConsultationDto (el que antes se leía de payloadJson) a partir de
  // las entidades reales (User + NutritionalConsultation con su Anamnesis/Measurements ya
  // populadas por getConsultationForOrder). Se reconstruye la MISMA forma en vez de
  // adaptar processPlan/los prompts al shape de las entidades: es mucho menos invasivo y deja
  // intacto todo el pipeline de abajo (cálculo de requerimientos, prompts, validadores).
  private buildCompleteConsultationDto(
    order: OrderEntity,
    consultation: NutritionalConsultationEntity,
  ): CompleteConsultationDto {
    if (!order.user)
      throw new Error(`Orden ${order.id}: falta el usuario asociado`);
    return {
      personalInfo: this.buildPersonalInfoDto(order.user),
      anamnesis: this.buildAnamnesisDto(consultation.anamneses?.[0]),
      measurements: this.buildMeasurementsDto(consultation.measurements?.[0]),
    };
  }

  private buildPersonalInfoDto(user: UserEntity): PersonalInfoDto {
    return {
      rut: user.rut ? Number(user.rut) : null,
      dvRut: user.rutCheckDigit,
      firstName: user.firstName,
      middleName: user.middleName,
      paternalLastName: user.paternalLastName,
      maternalLastName: user.maternalLastName,
      gender: user.gender,
      athlete: user.athlete,
      email: user.email,
      dateOfBirth: user.dateOfBirth,
    };
  }

  private buildAnamnesisDto(anamnesis?: AnamnesisEntity): AnamnesisDto {
    // Este flujo siempre crea a lo más una fila de cada colección por consulta (ver
    // CreateConsultationUseCase / consultation.mapper.ts), por eso se toma [0] de cada relación.
    const goals = anamnesis?.goals?.[0];
    const clinical = anamnesis?.anamnesisClinical?.[0];
    const dietary = anamnesis?.anamnesisDietary?.[0];
    const lifestyle = anamnesis?.lifestyles?.[0];
    const sportsStrategy = lifestyle?.sportsStrategies?.[0];

    return {
      goals: goals
        ? { primaryGoal: goals.mainGoal, secondaryGoal: goals.secondaryGoal }
        : null,
      clinical: clinical
        ? {
            pathology: clinical.pathology[0] ?? null,
            familyMedicalHistory: clinical.familyHistory,
            allergies: clinical.allergy[0] ?? null,
            intolerances: clinical.intolerance[0] ?? null,
            medications: clinical.medication[0] ?? null,
            gastrointestinalHistory: clinical.gastrointestinal[0] ?? null,
            bowelMovements: clinical.bowelMovement,
            surgeries: clinical.surgery[0] ?? null,
          }
        : null,
      dietary: dietary
        ? {
            r24h:
              dietary.dietaryRecalls24h?.[0]?.meals?.map((meal) => ({
                mealTime: meal.mealTime,
                cereals: meal.cereals,
                freeConsumptionVegetable: meal.freeConsumptionVegetable,
                generalConsumptionVegetable: meal.generalConsumptionVegetable,
                fruit: meal.fruit,
                highFatProtein: meal.highFatProtein,
                lowFatProtein: meal.lowFatProtein,
                highFatDairy: meal.highFatDairy,
                mediumFatDairy: meal.mediumFatDairy,
                lowFatDairy: meal.lowFatDairy,
                highProteinDairy: meal.highProteinDairy,
                highLipid: meal.lipidRich,
                oil: meal.oil,
                sugar: meal.sugar,
                alcohol: meal.alcohol,
              })) ?? null,
            foodPreferenceGroups:
              dietary.foodPreferences?.[0]?.groups?.map((group) => ({
                group: group.group ?? '',
                frequentConsumption: group.frequentConsumption,
                occasionalConsumption: group.occasionalConsumption,
                rareConsumption: group.rareConsumption,
                avoidedFoods: group.avoidedFoods,
              })) ?? null,
            sportsStrategy: sportsStrategy
              ? {
                  supplement: sportsStrategy.supplement
                    ? sportsStrategy.supplement.split(', ')
                    : null,
                  hydration: sportsStrategy.hydration
                    ? sportsStrategy.hydration.split(', ')
                    : null,
                  preActivityMeal: sportsStrategy.preActivityMeal,
                  duringActivityMeal: sportsStrategy.duringActivityMeal,
                  postActivityMeal: sportsStrategy.postActivityMeal,
                }
              : null,
          }
        : null,
      lifestyle: lifestyle
        ? {
            alcohol: lifestyle.alcohol,
            tobacco: lifestyle.tobacco,
            physicalActivityLevel: lifestyle.physicalActivityLevel,
            sport: lifestyle.sport,
            sportSession:
              lifestyle.sportsSessions?.map((session) => ({
                description: session.description,
                discipline: session.discipline,
                duration: session.duration,
                intensity: session.intensity,
                eventType: session.eventType,
                days: session.days,
                schedule: session.schedule,
              })) ?? null,
          }
        : null,
    };
  }

  private buildMeasurementsDto(
    measurements?: MeasurementsEntity,
  ): MeasurementsDto {
    const basic = measurements?.basicMeasurements?.[0];
    return {
      weight: basic?.weight ?? null,
      height: basic?.height ?? null,
      // El nuevo schema no tiene un campo dedicado para "somatotype"; se persiste como texto
      // libre en Measurements.description (ver orders.mapper.ts).
      somatotype: measurements?.description ?? null,
    };
  }

  //helper de processPlan() - el LLM extrae el NAF y objetivo del body
  private async extractInfoPrompt(
    body: CompleteConsultationDto,
  ): Promise<ExtractedInfo> {
    return this.llm.chatJson<ExtractedInfo>(
      EXTRACT_INFO_SYSTEM_PROMPT,
      [{ role: 'user', content: buildExtractInfoPromptUserMessage(body) }],
      OPENAI_MODEL_PLAN,
    );
  }

  // helper de validateGeneratedExamples()/validateGeneratedEquivalences() - dado un alimento concreto
  // que la IA reportó ({field, food, weight}), busca su gramaje base de 1 porción en el catálogo
  // (FOOD_GROUP_PORTIONS) y devuelve cuántas porciones implica el gramaje reportado (gramaje ÷
  // gramaje base). Devuelve null si el alimento no tiene gramaje base definido en el catálogo (ej
  // algunos alimentos "libre consumo" como ajo o zapallo italiano crudo): en ese caso no se puede
  // validar la proporción exacta en gramos, así que el caller debe confiar en la sola presencia del
  // alimento. Lanza si "field" no existe o si "food" no pertenece al grupo de ese campo.
  private implicitPortions(
    field: string,
    food: string,
    weight: number,
    context: string,
  ): number | null {
    const groupInfo = FOOD_FIELD_TO_GROUP[field];
    if (!groupInfo) {
      throw new PlanValidationError(`${context}: campo "${field}" no existe`);
    }
    const groupData = FOOD_GROUP_PORTIONS.find(
      (g) =>
        g.group === groupInfo.group && g.subcategory === groupInfo.subcategory,
    );
    const foodData = groupData?.foods.find(
      (f) => f.food.toLowerCase() === food.toLowerCase(),
    );
    if (!foodData) {
      throw new PlanValidationError(
        `${context}: alimento "${food}" no pertenece al grupo "${field}"`,
      );
    }
    if (!foodData.weight) return null;
    return weight / foodData.weight;
  }

  // helper de processPlan() - valida que, para cada tiempo de comida y cada uno de sus 3 ejemplos, el
  // desglose "components" que reportó la IA (ver meal-times.prompt.ts) sume EXACTAMENTE las
  // porciones ya calculadas por código (mealTime.numericPortions), sin parsear el texto libre del
  // ejemplo. Lanza un Error descriptivo ante cualquier desajuste; ese error lo captura el loop de
  // reintentos de execute().
  private validateGeneratedExamples(
    calculatedMealTimes: CalculatedMealTime[],
    generatedMealTimes: GeneratedNutritionPlan['mealTimes'],
  ): void {
    calculatedMealTimes.forEach((calculated, mealTimeIndex) => {
      const examples = generatedMealTimes[mealTimeIndex]?.examples ?? [];
      if (examples.length !== 3) {
        throw new PlanValidationError(
          `Tiempo de comida "${calculated.mealTimeType}" (índice ${mealTimeIndex}): se esperaban 3 ejemplos, se recibieron ${examples.length}`,
        );
      }

      const requiredByField = calculated.numericPortions as unknown as Record<
        string,
        number
      >;

      examples.forEach((example, exampleIndex) => {
        const context = `Tiempo "${calculated.mealTimeType}", ejemplo ${exampleIndex + 1}`;
        const usedPortionsByField: Record<string, number> = {};
        const fieldsWithoutBaseWeight = new Set<string>();

        for (const component of example.components) {
          const portions = this.implicitPortions(
            component.field,
            component.food,
            component.weight,
            context,
          );
          if (portions === null) {
            fieldsWithoutBaseWeight.add(component.field);
            continue;
          }
          usedPortionsByField[component.field] =
            (usedPortionsByField[component.field] ?? 0) + portions;
        }

        for (const [field, required] of Object.entries(requiredByField)) {
          if (!required || fieldsWithoutBaseWeight.has(field)) continue;
          const used = usedPortionsByField[field] ?? 0;
          if (Math.abs(used - required) > PORTION_TOLERANCE) {
            throw new PlanValidationError(
              `${context}: el grupo "${field}" requiere ${required} porciones y el ejemplo usa ${used.toFixed(2)}`,
            );
          }
        }

        for (const field of Object.keys(usedPortionsByField)) {
          if (!requiredByField[field]) {
            throw new PlanValidationError(
              `${context}: usa el grupo "${field}", que no corresponde a este tiempo de comida`,
            );
          }
        }
      });
    });
  }

  // helper de processPlan() - valida que, para cada tiempo de comida y cada grupo de "foods" de
  // ese tiempo, la IA haya entregado exactamente 3 "options" de equivalencia (ver
  // meal-times.prompt.ts), sin alimentos repetidos entre sí, y que cada una represente EXACTAMENTE
  // las porciones de ese grupo (misma tolerancia y misma lógica que validateGeneratedExamples, pero
  // aplicada a un único alimento por opción en vez de a una combinación). Lanza un Error descriptivo
  // ante cualquier desajuste; ese error lo captura el loop de reintentos de execute().
  private validateGeneratedEquivalences(
    calculatedMealTimes: CalculatedMealTime[],
    generatedMealTimes: GeneratedNutritionPlan['mealTimes'],
  ): void {
    calculatedMealTimes.forEach((calculated, mealTimeIndex) => {
      const requiredByField = calculated.numericPortions as unknown as Record<
        string,
        number
      >;
      const requiredFields = Object.entries(requiredByField)
        .filter(([, required]) => !!required)
        .map(([field]) => field);

      const equivalences =
        generatedMealTimes[mealTimeIndex]?.equivalences ?? [];
      const equivalenceByField = new Map(
        equivalences.map((group) => [group.field, group]),
      );

      for (const field of requiredFields) {
        const context = `Tiempo "${calculated.mealTimeType}", equivalencias de "${field}"`;
        const generatedGroup = equivalenceByField.get(field);
        if (!generatedGroup) {
          throw new PlanValidationError(
            `${context}: falta el desglose de equivalencias para este grupo`,
          );
        }
        if (generatedGroup.options.length !== 3) {
          throw new PlanValidationError(
            `${context}: se esperaban 3 opciones, se recibieron ${generatedGroup.options.length}`,
          );
        }

        const usedFoods = new Set<string>();
        for (const option of generatedGroup.options) {
          const normalizedFood = option.food.toLowerCase();
          if (usedFoods.has(normalizedFood)) {
            throw new PlanValidationError(
              `${context}: el alimento "${option.food}" está repetido entre las 3 opciones`,
            );
          }
          usedFoods.add(normalizedFood);

          const portions = this.implicitPortions(
            field,
            option.food,
            option.weight,
            context,
          );
          if (portions === null) continue;
          const required = requiredByField[field];
          if (Math.abs(portions - required) > PORTION_TOLERANCE) {
            throw new PlanValidationError(
              `${context}: "${option.food}" debería representar ${required} porciones y representa ${portions.toFixed(2)}`,
            );
          }
        }
      }
    });
  }

  //helper de failRound() - avisa por el canal de alertas (AlertNotifier) que una ronda de generación
  //falló. Es "critical" cuando ya no quedan reintentos automáticos (ERROR definitivo: el usuario pagó
  //y no tiene plan, requiere intervención manual) y "warning" mientras el job la vaya a retomar.
  private async notifyGenerationFailure(
    orderId: string,
    error: Error,
    previousAttempts: number | null,
  ): Promise<void> {
    const failedRounds = previousAttempts === null ? null : previousAttempts + 1;
    const isFinal = failedRounds !== null && failedRounds >= MAX_GENERATION_ROUNDS;
    await this.alertNotifier.notify({
      event: 'plan_generation_failed',
      severity: isFinal ? 'critical' : 'warning',
      message: isFinal
        ? `Orden ${orderId}: la generación del plan falló definitivamente, requiere intervención manual`
        : `Orden ${orderId}: falló una ronda de generación del plan, se reintentará automáticamente`,
      context: { orderId, failedRounds, final: isFinal, error: error.message },
    });
  }

  //helper de execute()
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
