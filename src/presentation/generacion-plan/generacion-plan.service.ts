//nest
import { Injectable, Logger } from '@nestjs/common';
//domain
import { ConsultaCompletaDto } from '../../domain/dtos/consulta-completa.dto';
import { PlanNutricionalDto } from '../../domain/dtos/plan-nutricional.dto';
import { calcularEdad } from '../../domain/services/utils/edad.service';
import { calculoRequerimientos } from '../../domain/services/formulas/requerimientos.service';
import { calculoSuplementos } from '../../domain/services/formulas/suplementos.service';
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

type PlanNutricionalGenerado = Omit<PlanNutricionalDto, 'informacion_personal'>;

type InfoPromp = {
  nivel_actividad_fisica: number;
  objetivo: string;
};

@Injectable()
export class GeneracionPlanService {
  private readonly logger = new Logger(GeneracionPlanService.name);

  constructor(
    private readonly ordenesService: OrdenesService,
    private readonly openaiService: OpenaiService,
    private readonly emailService: EmailService,
  ) {}

  //se dispara (sin await, "fire and forget") desde el webhook de pago una vez confirmado el cobro.
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

    for (let intento = 1; intento <= MAX_INTENTOS; intento++) {
      try {
        const plan = await this.procesar(payload);
        await this.ordenesService.completarGeneracion(ordenId, plan);
        this.logger.log(`Orden ${ordenId}: plan generado con éxito (intento ${intento})`);

        await this.emailService.enviarPlanPorCorreo(orden.correo, plan);
        return;
      } catch (error) {
        const esUltimoIntento = intento === MAX_INTENTOS;
        this.logger.warn(
          `Orden ${ordenId}: falló el intento ${intento}/${MAX_INTENTOS} de generación (${(error as Error).message})`,
        );

        if (esUltimoIntento) {
          await this.ordenesService.registrarIntentoFallido(ordenId);
          this.notificarFallaGeneracion(ordenId, error as Error);
          return;
        }

        await this.esperar(BACKOFF_BASE_MS * 2 ** (intento - 1));
      }
    }
  }

  //recibe la info de consulta y devuelve un objeto con el plan nutricional
  private async procesar(body: ConsultaCompletaDto): Promise<PlanNutricionalDto> {
    // se extrae informacion del promp: NAF y objetivo
    const { nivel_actividad_fisica, objetivo } = await this.extraerInfoPromp(body);
    //se extrae informacion del body
    const peso: number = body.mediciones?.peso!;
    const talla: number = body.mediciones?.talla!;
    const somatotipo: string = body.mediciones?.somatotipo!;
    const sexo: string = body.informacion_personal?.genero?.charAt(0).toUpperCase()!;
    const fechaNacimiento = body.informacion_personal?.fecha_nacimiento!;
    const edad = calcularEdad(fechaNacimiento);
    const deportista = body.informacion_personal?.deportista!;

    //1. calculo de requerimientos nutricionales
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

    //2. Adecuación de porciones

    //3. Generación de ejemplos

    //4. prescripcion de recomendaciones deportivas (por ahora solo suplementos)
    const supplementsPrescription = calculoSuplementos(peso)

    //generación de plan: promp + info consulta + requerimientos + prescripcion-suplementos
    const planGenerado = await this.openaiService.chatJson<PlanNutricionalGenerado>(
      NUTRICIONISTA_SYSTEM_PROMPT, 
      [{ role: 'user', content: buildUserPrompt(body, requerimientos, supplementsPrescription) }], //data consulta + requerimientos
    );

    //return
    return {
      informacion_personal: this.construirInformacionPersonal(body),
      ...planGenerado,
      prescripcion: { ...planGenerado.prescripcion, objetivo },
    };
  }

  //extrae, formatea y construye un objeto con informacion personal
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

  //extrae nivel_actividad_fisica y objetivo del body con ayuda de openai, para ser usados
  //en el cálculo del GET y en la prescripción del plan
  private async extraerInfoPromp(body: ConsultaCompletaDto): Promise<InfoPromp> {
    return this.openaiService.chatJson<InfoPromp>(
      EXTRAER_INFO_SYSTEM_PROMPT,
      [{ role: 'user', content: buildExtraerInfoPrompUserMessage(body) }],
    );
  }

  //punto de extensión: hoy es un log estructurado, mañana puede disparar una alerta real
  //(Slack, PagerDuty, email a soporte, etc.) sin tocar el resto del worker.
  private notificarFallaGeneracion(ordenId: string, error: Error): void {
    this.logger.error({
      evento: 'generacion_plan_fallida',
      ordenId,
      mensaje: error.message,
      // TODO: integrar con el canal de alertas/soporte que se defina.
    });
  }

  private esperar(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
