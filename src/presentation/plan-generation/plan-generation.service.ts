//nest
import { Injectable, Logger } from '@nestjs/common';
//domain
import { CompleteConsultationDto } from '../../domain/dtos/consultation.dto';
import { NutritionPlanDto, FoodWithEquivalence } from '../../domain/dtos/nutrition-plan.dto';
import { calculateAge } from '../../domain/services/utils/age.service';
import { calculateRequirements } from '../../domain/services/formulas/requirements.service';
import { calculateSupplements, SupplementPrescription } from '../../domain/services/formulas/supplements.service';
import { determineMealTimes } from '../../domain/services/alimentos/meal-times.service';
import {
  defineFoodGroups,
  calculateFoodsAndIntake,
  calculateTotalPlanIntake,
  calculateTotalAdequacy,
  CalculatedMealTime,
} from '../../domain/services/alimentos/portion-adequacy.service';
import { FOOD_FIELD_TO_GROUP, FOOD_GROUP_PORTIONS } from '../../domain/services/alimentos/food-portions';
//openai
import { OpenaiService } from '../openai/openai.service';
//presentation - modulo orders
import { OrdersService } from '../orders/orders.service';
//presentatation - modulo notifications
import { EmailService } from '../notifications/email.service';
//presentation - modulo plan-generation (actual)
import {
  buildExtractInfoPromptUserMessage,
  buildUserPrompt,
  EXTRACT_INFO_SYSTEM_PROMPT,
  NUTRITIONIST_SYSTEM_PROMPT,
} from './plan-generation.prompts';


const MAX_ATTEMPTS = 4;
const BACKOFF_BASE_MS = 1000;

// 'ordenes/crear' dispara la generación del plan cuando el usuario ya pagó: acá la precisión del
// resultado (aritmética de porciones, criterio clínico) pesa más que el costo por request, por eso usa
// un modelo más capaz que el de 'consulta/chat' (ver OPENAI_MODEL_CONSULTA en consultation.service.ts).
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

// Lanzado por implicitPortions()/validateGeneratedExamples()/validateGeneratedEquivalences() cuando
// la respuesta del LLM no calza con las porciones ya calculadas por código. Es una subclase de Error
// solo para poder distinguir en los logs de generatePlan() un reintento por "la IA se equivocó en el
// escalamiento" de un reintento por otro motivo (timeout, rate limit, respuesta no-JSON, etc).
class PlanValidationError extends Error {}


@Injectable()
export class PlanGenerationService {
  private readonly logger = new Logger(PlanGenerationService.name);

  constructor(
    private readonly ordersService: OrdersService,
    private readonly openaiService: OpenaiService,
    private readonly emailService: EmailService,
  ) {}

  //se dispara (sin await, "fire and forget") desde el webhook de pago una vez confirmado el cobro
  //cualquier error queda contenido acá adentro: nunca debe tirar una unhandled rejection.
  async generatePlan(orderId: string): Promise<void> {

    //guard de estado: si la orden ya está 'generando' (otro disparo concurrente) o 'completado',
    //no hace nada. Solo entra si estaba 'no_iniciado' o 'error' (reintento de un fallo previo).
    const canGenerate = await this.ordersService.tryStartGeneration(orderId);
    if (!canGenerate) {
      this.logger.log(`Orden ${orderId}: generación ya en curso o completada, se ignora el disparo`);
      return;
    }

    const order = await this.ordersService.findById(orderId);
    const payload = this.ordersService.getPayload(order);

    const totalStart = Date.now();
    let validationRejections = 0;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      const attemptStart = Date.now();
      try {
        const plan = await this.processPlan(payload);
        const attemptDurationMs = Date.now() - attemptStart;
        this.logger.log(`Orden ${orderId}: intento ${attempt}/${MAX_ATTEMPTS} generado en ${attemptDurationMs}ms`);

        await this.ordersService.completeGeneration(orderId, plan);
        const totalDurationMs = Date.now() - totalStart;
        this.logger.log(
          `Orden ${orderId}: plan generado con éxito (intento ${attempt}/${MAX_ATTEMPTS}, ` +
            `${validationRejections} rechazado(s) por validación, ${totalDurationMs}ms totales)`,
        );

        await this.emailService.sendPlanByEmail(order.email, plan);
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
          );
          await this.ordersService.recordFailedAttempt(orderId);
          this.notifyGenerationFailure(orderId, error as Error);
          return;
        }

        await this.sleep(BACKOFF_BASE_MS * 2 ** (attempt - 1));
      }
    }
  }

  //recibe la info de consulta y devuelve un objeto con el plan nutricional
  private async processPlan(body: CompleteConsultationDto): Promise<NutritionPlanDto> {
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
    })

    //PASO 2 - prescripcion: lo ejecuta la IA en base al prompt NUTRITIONIST_SYSTEM_PROMPT

    //PASO 3.1 - definir tiempos de comida
    const finalMealTimes = determineMealTimes(body.anamnesis?.dietary?.r24h ?? null, goal);
    //PASO 3.2 - definir grupos de alimentos base x tiempo
    const mealTimeGroups = defineFoodGroups(finalMealTimes);
    //PASO 3.3 - adecuación de porciones de alimentos
    const portionAdequacyResult = calculateFoodsAndIntake(mealTimeGroups, requirements);
    const { calculatedMealTimes, supplementIntakeNote, supplementIntake } = portionAdequacyResult;
    //calculo aporte total y adecuacion (considerando porciones y suplementos)
    const totalIntake = calculateTotalPlanIntake(portionAdequacyResult);
    const adequacy = calculateTotalAdequacy(totalIntake, requirements);

    //PASO 4 - generación de ejemplos y comentarios: lo ejecuta la IA en base al prompt NUTRITIONIST_SYSTEM_PROMPT

    //PASO 5 - calculo suplementos deportivos. se calculan, pero aún no se prrescriben (eso lo decide la IA)
    const supplementsPrescription = calculateSupplements(weight)

    //PASO 6 - recomendaciones deportivas: la IA decide cuales prescribe en base al prompt NUTRITIONIST_SYSTEM_PROMPT

    //generación de plan - codigo + IA
    const generated = await this.openaiService.chatJson<GeneratedNutritionPlan>(
      NUTRITIONIST_SYSTEM_PROMPT,
      [{ role: 'user', content: buildUserPrompt(
                                  body,
                                  requirements,
                                  goal,
                                  supplementsPrescription,
                                  calculatedMealTimes,
                                  supplementIntakeNote,
                                  supplementIntake,
                                )
      }],
      OPENAI_MODEL_PLAN,
    );

    // si los "examples"/"equivalences" que devolvió la IA no calzan con las porciones ya calculadas
    // por código, se lanza un error acá: lo captura el loop de reintentos de generatePlan() (con
    // backoff), que vuelve a llamar a processPlan() y a pedirle el plan completo a la IA desde cero.
    this.validateGeneratedExamples(calculatedMealTimes, generated.mealTimes);
    this.validateGeneratedEquivalences(calculatedMealTimes, generated.mealTimes);

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
          portion === null ? null : ({ portion, equivalence: equivalenceByField.get(field) ?? '' } as FoodWithEquivalence),
        ]),
      ) as NutritionPlanDto['mealTimes'][number]['foods'];

      return {
        description: { time: calculated.mealTimeType, hour: generatedMealTime?.hour ?? null },
        intake: calculated.intake,
        foods,
        examples: generatedMealTime?.examples.map((example) => example.text) ?? [],
        comments: generatedMealTime?.comments ?? [],
      };
    });

    //return
    return {
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
  }

  //helper de processPlan() - extrae, formatea y construye un objeto con informacion personal
  private buildPersonalInfo(
    body: CompleteConsultationDto,
  ): NutritionPlanDto['personalInfo'] {
    const info = body.personalInfo;

    const name = [info?.firstName, info?.middleName].filter(Boolean).join(' ');
    const lastName = [info?.paternalLastName, info?.maternalLastName].filter(Boolean).join(' ');
    const age = info?.dateOfBirth ? String(calculateAge(info.dateOfBirth)) : '';

    return {
      name,
      lastName,
      age,
      date: new Date().toISOString().split('T')[0],
    };
  }

  //helper de processPlan() - el LLM extrae el NAF y objetivo del body
  private async extractInfoPrompt(body: CompleteConsultationDto): Promise<ExtractedInfo> {
    return this.openaiService.chatJson<ExtractedInfo>(
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
  private implicitPortions(field: string, food: string, weight: number, context: string): number | null {
    const groupInfo = FOOD_FIELD_TO_GROUP[field];
    if (!groupInfo) {
      throw new PlanValidationError(`${context}: campo "${field}" no existe`);
    }
    const groupData = FOOD_GROUP_PORTIONS.find(
      (g) => g.group === groupInfo.group && g.subcategory === groupInfo.subcategory,
    );
    const foodData = groupData?.foods.find((f) => f.food.toLowerCase() === food.toLowerCase());
    if (!foodData) {
      throw new PlanValidationError(`${context}: alimento "${food}" no pertenece al grupo "${field}"`);
    }
    if (!foodData.weight) return null;
    return weight / foodData.weight;
  }

  // helper de processPlan() - valida que, para cada tiempo de comida y cada uno de sus 3 ejemplos, el
  // desglose "components" que reportó la IA (ver meal-times.prompt.ts) sume EXACTAMENTE las
  // porciones ya calculadas por código (mealTime.numericPortions), sin parsear el texto libre del
  // ejemplo. Lanza un Error descriptivo ante cualquier desajuste; ese error lo captura el loop de
  // reintentos de generatePlan().
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

      const requiredByField = calculated.numericPortions as unknown as Record<string, number>;

      examples.forEach((example, exampleIndex) => {
        const context = `Tiempo "${calculated.mealTimeType}", ejemplo ${exampleIndex + 1}`;
        const usedPortionsByField: Record<string, number> = {};
        const fieldsWithoutBaseWeight = new Set<string>();

        for (const component of example.components) {
          const portions = this.implicitPortions(component.field, component.food, component.weight, context);
          if (portions === null) {
            fieldsWithoutBaseWeight.add(component.field);
            continue;
          }
          usedPortionsByField[component.field] = (usedPortionsByField[component.field] ?? 0) + portions;
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
            throw new PlanValidationError(`${context}: usa el grupo "${field}", que no corresponde a este tiempo de comida`);
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
  // ante cualquier desajuste; ese error lo captura el loop de reintentos de generatePlan().
  private validateGeneratedEquivalences(
    calculatedMealTimes: CalculatedMealTime[],
    generatedMealTimes: GeneratedNutritionPlan['mealTimes'],
  ): void {
    calculatedMealTimes.forEach((calculated, mealTimeIndex) => {
      const requiredByField = calculated.numericPortions as unknown as Record<string, number>;
      const requiredFields = Object.entries(requiredByField)
        .filter(([, required]) => !!required)
        .map(([field]) => field);

      const equivalences = generatedMealTimes[mealTimeIndex]?.equivalences ?? [];
      const equivalenceByField = new Map(equivalences.map((group) => [group.field, group]));

      for (const field of requiredFields) {
        const context = `Tiempo "${calculated.mealTimeType}", equivalencias de "${field}"`;
        const generatedGroup = equivalenceByField.get(field);
        if (!generatedGroup) {
          throw new PlanValidationError(`${context}: falta el desglose de equivalencias para este grupo`);
        }
        if (generatedGroup.options.length !== 3) {
          throw new PlanValidationError(`${context}: se esperaban 3 opciones, se recibieron ${generatedGroup.options.length}`);
        }

        const usedFoods = new Set<string>();
        for (const option of generatedGroup.options) {
          const normalizedFood = option.food.toLowerCase();
          if (usedFoods.has(normalizedFood)) {
            throw new PlanValidationError(`${context}: el alimento "${option.food}" está repetido entre las 3 opciones`);
          }
          usedFoods.add(normalizedFood);

          const portions = this.implicitPortions(field, option.food, option.weight, context);
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

  //helper de processPlan() - punto de extensión: hoy es un log estructurado, mañana puede disparar una alerta real
  //(Slack, PagerDuty, email a soporte, etc.) sin tocar el resto del worker.
  private notifyGenerationFailure(orderId: string, error: Error): void {
    this.logger.error({
      event: 'plan_generation_failed',
      orderId,
      message: error.message,
      // TODO: integrar con el canal de alertas/soporte que se defina.
    });
  }

  //helper de generatePlan()
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
