import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '../../infrastructure/orm/prisma/prisma.service';
import { ConsultaCompletaDto, EstadoGeneracion, OrdenEstadoDto, PlanNutricionalDto } from '../../domain';
import { Orden } from '../../../generated/prisma';
import { ConsultaCompletaDtoImpl } from '../consulta/dto/consulta-completa.dto';

@Injectable()
export class OrdenesService {
  private readonly logger = new Logger(OrdenesService.name);

  constructor(private readonly prisma: PrismaService) {}

  //crea la orden en estado_pago='pendiente', antes de que el usuario pague
  //(el webhook de pago es server-a-server y no tiene acceso al localStorage del navegador)
  async crearOrden(dto: ConsultaCompletaDtoImpl): Promise<{ orden_id: string }> {
    const correo = dto.informacion_personal?.correo;
    if (!correo) {
      throw new BadRequestException('Falta el correo de contacto para la orden');
    }

    const orden = await this.prisma.orden.create({
      data: {
        id: uuidv4(),
        correo,
        payload_json: JSON.stringify(dto),
      },
    });

    return { orden_id: orden.id };
  }

  //estado público que consulta el frontend (sin payload_json, que es información interna)
  async obtenerEstado(id: string): Promise<OrdenEstadoDto> {
    const orden = await this.buscarPorId(id);
    return {
      estado_pago: orden.estado_pago as OrdenEstadoDto['estado_pago'],
      estado_generacion: orden.estado_generacion as EstadoGeneracion,
      plan_json: orden.plan_json ? (JSON.parse(orden.plan_json) as PlanNutricionalDto) : null,
    };
  }

  async buscarPorId(id: string): Promise<Orden> {
    const orden = await this.prisma.orden.findUnique({ where: { id } });
    if (!orden) throw new NotFoundException(`Orden ${id} no encontrada`);
    return orden;
  }

  obtenerPayload(orden: Orden): ConsultaCompletaDto {
    return JSON.parse(orden.payload_json!) as ConsultaCompletaDto;
  }

  //idempotente: si ya estaba pagada, no vuelve a marcarla ni dispara nada.
  //devuelve true si esta llamada fue la que efectivamente marcó el pago.
  async marcarPagada(id: string): Promise<boolean> {
    const { count } = await this.prisma.orden.updateMany({
      where: { id, estado_pago: 'pendiente' },
      data: { estado_pago: 'pagado' },
    });
    return count > 0;
  }

  //guard de estado: solo entra a 'generando' si no estaba ya en ese estado,
  //para evitar que dos disparos concurrentes (ej. reintento manual de webhook) generen el plan dos veces.
  async intentarIniciarGeneracion(id: string): Promise<boolean> {
    const { count } = await this.prisma.orden.updateMany({
      where: { id, estado_generacion: { in: ['no_iniciado', 'error'] } },
      data: { estado_generacion: 'generando' },
    });
    return count > 0;
  }

  async completarGeneracion(id: string, plan: PlanNutricionalDto): Promise<void> {
    await this.prisma.orden.update({
      where: { id },
      data: { estado_generacion: 'completado', plan_json: JSON.stringify(plan) },
    });
  }

  async registrarIntentoFallido(id: string): Promise<void> {
    await this.prisma.orden.update({
      where: { id },
      data: { estado_generacion: 'error', intentos: { increment: 1 } },
    });
  }

  //job de retención: anula el contenido sensible de órdenes antiguas, conservando el resto de la fila
  async limpiarOrdenesAntiguas(diasRetencion: number): Promise<number> {
    const limite = new Date();
    limite.setDate(limite.getDate() - diasRetencion);

    const { count } = await this.prisma.orden.updateMany({
      where: { created_at: { lt: limite }, OR: [{ payload_json: { not: null } }, { plan_json: { not: null } }] },
      data: { payload_json: null, plan_json: null },
    });

    if (count > 0) this.logger.log(`Limpieza de retención: ${count} orden(es) anonimizadas`);
    return count;
  }
}
