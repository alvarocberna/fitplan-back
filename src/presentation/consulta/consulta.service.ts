import { Injectable } from '@nestjs/common';
import { ConsultaCompletaDto } from '../../domain/dtos/consulta-completa.dto';
import { PlanNutricionalDto } from '../../domain/dtos/plan-nutricional.dto';
import { calcularEdad } from '../../domain/services/utils/edad.service';
import { OpenaiService } from '../openai/openai.service';
import { buildUserPrompt, NUTRICIONISTA_SYSTEM_PROMPT } from './consulta.prompts';

type PlanNutricionalGenerado = Omit<PlanNutricionalDto, 'informacion_personal'>;

@Injectable()
export class ConsultaService {
  constructor(private readonly openaiService: OpenaiService) {}

  async procesar(body: ConsultaCompletaDto): Promise<PlanNutricionalDto> {
    const planGenerado = await this.openaiService.chatJson<PlanNutricionalGenerado>(
      NUTRICIONISTA_SYSTEM_PROMPT,
      [{ role: 'user', content: buildUserPrompt(body) }],
    );

    return {
      informacion_personal: this.construirInformacionPersonal(body),
      ...planGenerado,
    };
  }

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
}
