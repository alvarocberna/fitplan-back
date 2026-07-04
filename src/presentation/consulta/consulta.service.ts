//NEST
import { Injectable } from '@nestjs/common';
//DOMAIN
import { ConsultaCompletaDto } from '../../domain/dtos/consulta-completa.dto';
import { PlanNutricionalDto } from '../../domain/dtos/plan-nutricional.dto';
import { calcularEdad } from '../../domain/services/utils/edad.service';
import { calculoRequerimientos } from '../../domain/services/formulas/requerimientos.service';
//OPENAI
import { OpenaiService } from '../openai/openai.service';
//PRESENTATION - CONSULTA
import {
  buildExtraerInfoPrompUserMessage,
  buildUserPrompt,
  EXTRAER_INFO_SYSTEM_PROMPT,
  NUTRICIONISTA_SYSTEM_PROMPT,
} from './consulta.prompts';


type PlanNutricionalGenerado = Omit<PlanNutricionalDto, 'informacion_personal'>;

type InfoPromp = {
  nivel_actividad_fisica: number;
  objetivo: string;
};

@Injectable()
export class ConsultaService {
  constructor(private readonly openaiService: OpenaiService) {}

  //recibe la info de consulta y devuelve un objeto con el plan nutricional
  async procesar(body: ConsultaCompletaDto): Promise<PlanNutricionalDto> {

    // se extrae informacion del promp: NAF y objetivo
    const { nivel_actividad_fisica, objetivo } = await this.extraerInfoPromp(body);
    //se extrae informacion del body
    const peso:number = body.mediciones?.peso!;
    const talla:number = body.mediciones?.talla!;
    const sexo:string = body.informacionPersonal?.genero?.charAt(0).toUpperCase()!;
    const fechaNacimiento = body.informacionPersonal?.fecha_nacimiento!;
    const edad = calcularEdad(fechaNacimiento);
    // calculo de requerimientos nutricionales
    const requerimientos = calculoRequerimientos({
      peso: peso, talla: talla, sexo: sexo, edad: edad, nivel_actividad_fisica: nivel_actividad_fisica, objetivo: objetivo
    })
    //el service de opanai recibe un promp con instrucciones para generar el plan + la información de este
    const planGenerado = await this.openaiService.chatJson<PlanNutricionalGenerado>(
      NUTRICIONISTA_SYSTEM_PROMPT, //promp con instrucciones
      [{ role: 'user', content: buildUserPrompt(body, requerimientos) }], //data consulta + requerimientos
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
    const info = body.informacionPersonal;

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
}
