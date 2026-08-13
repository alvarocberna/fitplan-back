//nest
import { Injectable, Logger } from '@nestjs/common';
//domain
import { ConsultaCompletaDto } from '../../domain/dtos/consulta-completa.dto';
import { PlanNutricionalDto, AlimentoConEquivalencia } from '../../domain/dtos/plan-nutricional.dto';
import { calcularEdad } from '../../domain/services/utils/edad.service';
import { calculoRequerimientos } from '../../domain/services/formulas/requerimientos.service';
import { calculoSuplementos, SupplementPrescription } from '../../domain/services/formulas/suplementos.service';
import { determinarTiemposDeComida } from '../../domain/services/alimentos/tiempos-comida.service';
import {
  definirGruposAlimentos,
  calcularAlimentosYAporte,
  calcularAporteTotalPlan,
  calcularAdecuacionTotal,
  TiempoComidaCalculado,
} from '../../domain/services/alimentos/adecuacion-porciones.service';
import { CAMPO_ALIMENTOS_A_GRUPO, PORCIONES_GRUPOS_ALIMENTOS } from '../../domain/services/alimentos/porciones-alimentos';
//openai
import { OpenaiService } from '../openai/openai.service';
//presentation - modulo ordenes
import { OrdenesService } from '../ordenes/ordenes.service';
//presentatation - modulo notificaciones
import { EmailService } from '../notificaciones/email.service';
//presentation - modulo generacion-plan (actual)
import {
  buildExtraerInfoPrompUserMessage,
  buildUserPrompt,
  EXTRAER_INFO_SYSTEM_PROMPT,
  NUTRICIONISTA_SYSTEM_PROMPT,
} from './generacion-plan.prompts';


const MAX_INTENTOS = 4;
const BACKOFF_BASE_MS = 1000;

// 'ordenes/crear' dispara la generación del plan cuando el usuario ya pagó: acá la precisión del
// resultado (aritmética de porciones, criterio clínico) pesa más que el costo por request, por eso usa
// un modelo más capaz que el de 'consulta/chat' (ver OPENAI_MODEL_CONSULTA en consulta.service.ts).
// Configurable vía env var sin necesidad de redeploy.
// NOTA: no se fija "temperature" acá porque gpt-5-mini solo soporta su valor default (1) -la API
// devuelve 400 ("Unsupported value: 'temperature'...") si se envía cualquier otro valor-.
const OPENAI_MODEL_PLAN = process.env.OPENAI_MODEL_PLAN ?? 'gpt-5-mini';

// Tolerancia (en porciones) al comparar lo que la IA reporta en "componentes" contra las porciones
// exactas ya calculadas por código: cubre solo errores de redondeo de punto flotante, no errores reales
// de escalamiento (ver validarEjemplosGenerados).
const TOLERANCIA_PORCIONES = 0.05;

// Desglose verificable de un ejemplo: por cada alimento que la IA usó en "texto", declara a qué grupo
// pertenece, cuál es, y cuántos gramos le asignó. Permite validar en código que "texto" respeta
// EXACTAMENTE las porciones calculadas, sin tener que parsear el texto libre (ver tiempos-comida.prompt.ts).
type ComponenteEjemploGenerado = {
  campo: string;
  alimento: string;
  gramaje: number;
};

type EjemploGenerado = {
  texto: string;
  componentes: ComponenteEjemploGenerado[];
};

// Una opción de "equivalencias": un único alimento de un grupo, ya escalado a la cantidad de porciones
// que le corresponde a ese grupo (misma lógica que ComponenteEjemploGenerado, pero para un solo
// alimento en vez de una combinación).
type OpcionEquivalenciaGenerada = {
  texto: string;
  alimento: string;
  gramaje: number;
};

type EquivalenciaGrupoGenerada = {
  campo: string;
  opciones: OpcionEquivalenciaGenerada[];
};

type PlanNutricionalGenerado = {
  prescripcion: {
    regimen: string;
    objetivo: string;
  };
  tiempos_de_comida: {
    hora: string | null;
    ejemplos: EjemploGenerado[];
    equivalencias: EquivalenciaGrupoGenerada[];
    comentarios: string[];
  }[];
  suplementos: SupplementPrescription[];
  recomendaciones_deportivas: PlanNutricionalDto['recomendaciones_deportivas'];
};

type InfoPromp = {
  nivel_actividad_fisica: number;
  objetivo: string;
};

// Lanzado por porcionesImplicitas()/validarEjemplosGenerados()/validarEquivalenciasGeneradas() cuando
// la respuesta del LLM no calza con las porciones ya calculadas por código. Es una subclase de Error
// solo para poder distinguir en los logs de generarPlan() un reintento por "la IA se equivocó en el
// escalamiento" de un reintento por otro motivo (timeout, rate limit, respuesta no-JSON, etc).
class ValidacionPlanError extends Error {}


@Injectable()
export class GeneracionPlanService {
  private readonly logger = new Logger(GeneracionPlanService.name);

  constructor(
    private readonly ordenesService: OrdenesService,
    private readonly openaiService: OpenaiService,
    private readonly emailService: EmailService,
  ) {}

  //se dispara (sin await, "fire and forget") desde el webhook de pago una vez confirmado el cobro
  //cualquier error queda contenido acá adentro: nunca debe tirar una unhandled rejection.
  async generarPlan(ordenId: string): Promise<void> {

    //guard de estado: si la orden ya está 'generando' (otro disparo concurrente) o 'completado',
    //no hace nada. Solo entra si estaba 'no_iniciado' o 'error' (reintento de un fallo previo).
    const puedeGenerar = await this.ordenesService.intentarIniciarGeneracion(ordenId);
    if (!puedeGenerar) {
      this.logger.log(`Orden ${ordenId}: generación ya en curso o completada, se ignora el disparo`);
      return;
    }

    const orden = await this.ordenesService.buscarPorId(ordenId);
    const payload = this.ordenesService.obtenerPayload(orden);

    const inicioTotal = Date.now();
    let rechazosPorValidacion = 0;

    for (let intento = 1; intento <= MAX_INTENTOS; intento++) {
      const inicioIntento = Date.now();
      try {
        const plan = await this.procesarPlan(payload);
        const duracionIntentoMs = Date.now() - inicioIntento;
        this.logger.log(`Orden ${ordenId}: intento ${intento}/${MAX_INTENTOS} generado en ${duracionIntentoMs}ms`);

        await this.ordenesService.completarGeneracion(ordenId, plan);
        const duracionTotalMs = Date.now() - inicioTotal;
        this.logger.log(
          `Orden ${ordenId}: plan generado con éxito (intento ${intento}/${MAX_INTENTOS}, ` +
            `${rechazosPorValidacion} rechazado(s) por validación, ${duracionTotalMs}ms totales)`,
        );

        await this.emailService.enviarPlanPorCorreo(orden.correo, plan);
        return;
      } catch (error) {
        const duracionIntentoMs = Date.now() - inicioIntento;
        const esErrorValidacion = error instanceof ValidacionPlanError;
        if (esErrorValidacion) rechazosPorValidacion++;

        const esUltimoIntento = intento === MAX_INTENTOS;
        this.logger.warn(
          `Orden ${ordenId}: falló el intento ${intento}/${MAX_INTENTOS} en ${duracionIntentoMs}ms` +
            `${esErrorValidacion ? ' (rechazado por validación de ejemplos/equivalencias)' : ''} ` +
            `(${(error as Error).message})`,
        );

        if (esUltimoIntento) {
          const duracionTotalMs = Date.now() - inicioTotal;
          this.logger.error(
            `Orden ${ordenId}: se agotaron los ${MAX_INTENTOS} intentos (${rechazosPorValidacion} ` +
              `rechazado(s) por validación), ${duracionTotalMs}ms totales`,
          );
          await this.ordenesService.registrarIntentoFallido(ordenId);
          this.notificarFallaGeneracion(ordenId, error as Error);
          return;
        }

        await this.esperar(BACKOFF_BASE_MS * 2 ** (intento - 1));
      }
    }
  }

  //recibe la info de consulta y devuelve un objeto con el plan nutricional
  private async procesarPlan(body: ConsultaCompletaDto): Promise<PlanNutricionalDto> {
    //se extrae informacion del promp: NAF y objetivo
    const { nivel_actividad_fisica, objetivo } = await this.extraerInfoPromp(body);
    //se extrae informacion del body
    const peso: number = body.mediciones?.peso!;
    const talla: number = body.mediciones?.talla!;
    const somatotipo: string = body.mediciones?.somatotipo!;
    const sexo: string = body.informacion_personal?.genero?.charAt(0).toUpperCase()!;
    const fechaNacimiento = body.informacion_personal?.fecha_nacimiento!;
    const edad = calcularEdad(fechaNacimiento);
    const deportista = body.informacion_personal?.deportista!;

    //PASO 1 - cálculo de requerimientos nutricionales (paso 1 doc)
    const requerimientos = calculoRequerimientos({
      peso: peso, 
      talla: talla, 
      sexo: sexo, 
      edad: edad, 
      nivel_actividad_fisica: nivel_actividad_fisica, 
      objetivo: objetivo,
      deportista: deportista,
      somatotipo: somatotipo,
    })

    //PASO 2 - prescripcion: lo ejecuta la IA en base al promp NUTRICIONISTA_SYSTEM_PROMPT

    //PASO 3.1 - definir tiempos de comida 
    const tiemposFinales = determinarTiemposDeComida(body.anamnesis?.alimentaria?.r24h ?? null, objetivo); 
    //PASO 3.2 - definir grupos de alimentos base x tiempo
    const tiemposGrupos = definirGruposAlimentos(tiemposFinales);
    //PASO 3.3 - adecuación de porciones de alimentos 
    const porcionesAlimentosCalculadas = calcularAlimentosYAporte(tiemposGrupos, requerimientos);
    const { adecuacion_porciones: tiemposCalculados, adecuacion_suplementos, aporte_suplementos } = porcionesAlimentosCalculadas;
    //calculo aporte total y adecuacion (considerando porciones y suplementos)
    const aporte_total = calcularAporteTotalPlan(porcionesAlimentosCalculadas);
    const adecuacion = calcularAdecuacionTotal(aporte_total, requerimientos);

    //PASO 4 - generación de ejemplos y comentarios: lo ejecuta la IA en base al promp NUTRICIONISTA_SYSTEM_PROMPT
    
    //PASO 5 - calculo suplementos deportivos. se calculan, pero aún no se prrescriben (eso lo decide la IA)
    const supplementsPrescription = calculoSuplementos(peso)

    //PASO 6 - recomendaciones deportivas: la IA decide cuales prescribe en base al promp NUTRICIONISTA_SYSTEM_PROMPT

    //generación de plan - codigo + IA
    const generado = await this.openaiService.chatJson<PlanNutricionalGenerado>(
      NUTRICIONISTA_SYSTEM_PROMPT,
      [{ role: 'user', content: buildUserPrompt(
                                  body,
                                  requerimientos,
                                  objetivo,
                                  supplementsPrescription,
                                  tiemposCalculados,
                                  adecuacion_suplementos,
                                  aporte_suplementos
                                )
      }],
      OPENAI_MODEL_PLAN,
    );

    // si los "ejemplos"/"equivalencias" que devolvió la IA no calzan con las porciones ya calculadas
    // por código, se lanza un error acá: lo captura el loop de reintentos de generarPlan() (con
    // backoff), que vuelve a llamar a procesarPlan() y a pedirle el plan completo a la IA desde cero.
    this.validarEjemplosGenerados(tiemposCalculados, generado.tiempos_de_comida);
    this.validarEquivalenciasGeneradas(tiemposCalculados, generado.tiempos_de_comida);

    //merge: "alimentos" (porción calculada por código + equivalencia redactada por la IA) y "aporte"
    //vienen del cálculo por código; "hora", "ejemplos" y "comentarios" vienen de la IA, alineados por
    //índice con tiemposCalculados.
    const tiempos_de_comida = tiemposCalculados.map((calculado, indice) => {
      const generadoTiempo = generado.tiempos_de_comida[indice];
      const equivalenciaPorCampo = new Map(
        (generadoTiempo?.equivalencias ?? []).map((grupo) => [
          grupo.campo,
          grupo.opciones.map((opcion) => opcion.texto).join(', '),
        ]),
      );

      const alimentos = Object.fromEntries(
        Object.entries(calculado.alimentos).map(([campo, porcion]) => [
          campo,
          porcion === null ? null : ({ porcion, equivalencia: equivalenciaPorCampo.get(campo) ?? '' } as AlimentoConEquivalencia),
        ]),
      ) as PlanNutricionalDto['tiempos_de_comida'][number]['alimentos'];

      return {
        description: { tiempo: calculado.tiempo, hora: generadoTiempo?.hora ?? null },
        aporte: calculado.aporte,
        alimentos,
        ejemplos: generadoTiempo?.ejemplos.map((ejemplo) => ejemplo.texto) ?? [],
        comentarios: generadoTiempo?.comentarios ?? [],
      };
    });

    //return
    return {
      informacion_personal: this.construirInformacionPersonal(body),
      prescripcion: {
        regimen: generado.prescripcion.regimen,
        objetivo: generado.prescripcion.objetivo,
        calorias: requerimientos.energia,
        proteina: requerimientos.proteina,
        carbohidrato: requerimientos.carbohidrato,
        lipido: requerimientos.lipido,
      },
      aporte_plan: { adecuacion, aporte_total },
      tiempos_de_comida,
      suplementos: generado.suplementos,
      recomendaciones_deportivas: generado.recomendaciones_deportivas,
    };
  }

  //helper de procesarPlan() - extrae, formatea y construye un objeto con informacion personal
  private construirInformacionPersonal(
    body: ConsultaCompletaDto,
  ): PlanNutricionalDto['informacion_personal'] {
    const info = body.informacion_personal;

    const nombre = [info?.nombre_primero, info?.nombre_segundo].filter(Boolean).join(' ');
    const apellido = [info?.apellido_paterno, info?.apellido_materno].filter(Boolean).join(' ');
    const edad = info?.fecha_nacimiento ? String(calcularEdad(info.fecha_nacimiento)) : '';

    return {
      nombre,
      apellido,
      edad,
      fecha: new Date().toISOString().split('T')[0],
    };
  }

  //helper de procesarPlan() - el LLM extrae el NAF y objetivo del body
  private async extraerInfoPromp(body: ConsultaCompletaDto): Promise<InfoPromp> {
    return this.openaiService.chatJson<InfoPromp>(
      EXTRAER_INFO_SYSTEM_PROMPT,
      [{ role: 'user', content: buildExtraerInfoPrompUserMessage(body) }],
      OPENAI_MODEL_PLAN,
    );
  }

  // helper de validarEjemplosGenerados()/validarEquivalenciasGeneradas() - dado un alimento concreto
  // que la IA reportó ({campo, alimento, gramaje}), busca su gramaje base de 1 porción en el catálogo
  // (PORCIONES_GRUPOS_ALIMENTOS) y devuelve cuántas porciones implica el gramaje reportado (gramaje ÷
  // gramaje base). Devuelve null si el alimento no tiene gramaje base definido en el catálogo (ej
  // algunos alimentos "libre consumo" como ajo o zapallo italiano crudo): en ese caso no se puede
  // validar la proporción exacta en gramos, así que el caller debe confiar en la sola presencia del
  // alimento. Lanza si "campo" no existe o si "alimento" no pertenece al grupo de ese campo.
  private porcionesImplicitas(campo: string, alimento: string, gramaje: number, contexto: string): number | null {
    const grupoInfo = CAMPO_ALIMENTOS_A_GRUPO[campo];
    if (!grupoInfo) {
      throw new ValidacionPlanError(`${contexto}: campo "${campo}" no existe`);
    }
    const grupoData = PORCIONES_GRUPOS_ALIMENTOS.find(
      (g) => g.grupo === grupoInfo.grupo && g.subcategoria === grupoInfo.subcategoria,
    );
    const alimentoData = grupoData?.alimentos.find((a) => a.alimento.toLowerCase() === alimento.toLowerCase());
    if (!alimentoData) {
      throw new ValidacionPlanError(`${contexto}: alimento "${alimento}" no pertenece al grupo "${campo}"`);
    }
    if (!alimentoData.gramaje) return null;
    return gramaje / alimentoData.gramaje;
  }

  // helper de procesarPlan() - valida que, para cada tiempo de comida y cada uno de sus 3 ejemplos, el
  // desglose "componentes" que reportó la IA (ver tiempos-comida.prompt.ts) sume EXACTAMENTE las
  // porciones ya calculadas por código (tiempo.porcionesNumericas), sin parsear el texto libre del
  // ejemplo. Lanza un Error descriptivo ante cualquier desajuste; ese error lo captura el loop de
  // reintentos de generarPlan().
  private validarEjemplosGenerados(
    tiemposCalculados: TiempoComidaCalculado[],
    tiemposGenerados: PlanNutricionalGenerado['tiempos_de_comida'],
  ): void {
    tiemposCalculados.forEach((calculado, indiceTiempo) => {
      const ejemplos = tiemposGenerados[indiceTiempo]?.ejemplos ?? [];
      if (ejemplos.length !== 3) {
        throw new ValidacionPlanError(
          `Tiempo de comida "${calculado.tiempo}" (índice ${indiceTiempo}): se esperaban 3 ejemplos, se recibieron ${ejemplos.length}`,
        );
      }

      const requeridoPorCampo = calculado.porcionesNumericas as unknown as Record<string, number>;

      ejemplos.forEach((ejemplo, indiceEjemplo) => {
        const contexto = `Tiempo "${calculado.tiempo}", ejemplo ${indiceEjemplo + 1}`;
        const porcionesUsadasPorCampo: Record<string, number> = {};
        const camposSinGramajeBase = new Set<string>();

        for (const componente of ejemplo.componentes) {
          const porciones = this.porcionesImplicitas(componente.campo, componente.alimento, componente.gramaje, contexto);
          if (porciones === null) {
            camposSinGramajeBase.add(componente.campo);
            continue;
          }
          porcionesUsadasPorCampo[componente.campo] = (porcionesUsadasPorCampo[componente.campo] ?? 0) + porciones;
        }

        for (const [campo, requerido] of Object.entries(requeridoPorCampo)) {
          if (!requerido || camposSinGramajeBase.has(campo)) continue;
          const usado = porcionesUsadasPorCampo[campo] ?? 0;
          if (Math.abs(usado - requerido) > TOLERANCIA_PORCIONES) {
            throw new ValidacionPlanError(
              `${contexto}: el grupo "${campo}" requiere ${requerido} porciones y el ejemplo usa ${usado.toFixed(2)}`,
            );
          }
        }

        for (const campo of Object.keys(porcionesUsadasPorCampo)) {
          if (!requeridoPorCampo[campo]) {
            throw new ValidacionPlanError(`${contexto}: usa el grupo "${campo}", que no corresponde a este tiempo de comida`);
          }
        }
      });
    });
  }

  // helper de procesarPlan() - valida que, para cada tiempo de comida y cada grupo de "alimentos" de
  // ese tiempo, la IA haya entregado exactamente 3 "opciones" de equivalencia (ver
  // tiempos-comida.prompt.ts), sin alimentos repetidos entre sí, y que cada una represente EXACTAMENTE
  // las porciones de ese grupo (misma tolerancia y misma lógica que validarEjemplosGenerados, pero
  // aplicada a un único alimento por opción en vez de a una combinación). Lanza un Error descriptivo
  // ante cualquier desajuste; ese error lo captura el loop de reintentos de generarPlan().
  private validarEquivalenciasGeneradas(
    tiemposCalculados: TiempoComidaCalculado[],
    tiemposGenerados: PlanNutricionalGenerado['tiempos_de_comida'],
  ): void {
    tiemposCalculados.forEach((calculado, indiceTiempo) => {
      const requeridoPorCampo = calculado.porcionesNumericas as unknown as Record<string, number>;
      const camposRequeridos = Object.entries(requeridoPorCampo)
        .filter(([, requerido]) => !!requerido)
        .map(([campo]) => campo);

      const equivalencias = tiemposGenerados[indiceTiempo]?.equivalencias ?? [];
      const equivalenciaPorCampo = new Map(equivalencias.map((grupo) => [grupo.campo, grupo]));

      for (const campo of camposRequeridos) {
        const contexto = `Tiempo "${calculado.tiempo}", equivalencias de "${campo}"`;
        const grupoGenerado = equivalenciaPorCampo.get(campo);
        if (!grupoGenerado) {
          throw new ValidacionPlanError(`${contexto}: falta el desglose de equivalencias para este grupo`);
        }
        if (grupoGenerado.opciones.length !== 3) {
          throw new ValidacionPlanError(`${contexto}: se esperaban 3 opciones, se recibieron ${grupoGenerado.opciones.length}`);
        }

        const alimentosUsados = new Set<string>();
        for (const opcion of grupoGenerado.opciones) {
          const alimentoNormalizado = opcion.alimento.toLowerCase();
          if (alimentosUsados.has(alimentoNormalizado)) {
            throw new ValidacionPlanError(`${contexto}: el alimento "${opcion.alimento}" está repetido entre las 3 opciones`);
          }
          alimentosUsados.add(alimentoNormalizado);

          const porciones = this.porcionesImplicitas(campo, opcion.alimento, opcion.gramaje, contexto);
          if (porciones === null) continue;
          const requerido = requeridoPorCampo[campo];
          if (Math.abs(porciones - requerido) > TOLERANCIA_PORCIONES) {
            throw new ValidacionPlanError(
              `${contexto}: "${opcion.alimento}" debería representar ${requerido} porciones y representa ${porciones.toFixed(2)}`,
            );
          }
        }
      }
    });
  }

  //helper de procesarPlan() - punto de extensión: hoy es un log estructurado, mañana puede disparar una alerta real
  //(Slack, PagerDuty, email a soporte, etc.) sin tocar el resto del worker.
  private notificarFallaGeneracion(ordenId: string, error: Error): void {
    this.logger.error({
      evento: 'generacion_plan_fallida',
      ordenId,
      mensaje: error.message,
      // TODO: integrar con el canal de alertas/soporte que se defina.
    });
  }

  //helper de generarPlan()
  private esperar(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
