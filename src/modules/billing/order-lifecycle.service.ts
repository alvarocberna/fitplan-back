import { Injectable, NotFoundException } from '@nestjs/common';
import { GenerationStatus, NutritionPlanDto } from '../../domain';
import { OrderEntity } from '../../domain/entities/order.entity';
import { OrderRepository } from '../../domain/repositories/commercial-domain/order.repository';

// Transiciones de generationStatus de una orden. billing es el único módulo que escribe `order`: la
// generación del plan (plans) pasa por acá en vez de tocar el repositorio directamente.
@Injectable()
export class OrderLifecycleService {
  constructor(private readonly orderRepository: OrderRepository) {}

  // Orden con su usuario (para el email) y su producto (para el nombre del plan).
  async findByIdWithUser(id: string): Promise<OrderEntity> {
    const order = await this.orderRepository.getOrderWithUserById(id);
    if (!order) throw new NotFoundException(`Orden ${id} no encontrada`);
    return order;
  }

  // Guard de estado: solo entra a GENERATING si estaba NOT_STARTED o ERROR, para evitar que dos
  // disparos concurrentes (ej. reintento manual del webhook) generen el plan dos veces.
  tryStartGeneration(id: string): Promise<boolean> {
    return this.orderRepository.tryTransitionOrderToGenerating(id);
  }

  async completeGeneration(
    id: string,
    plan: NutritionPlanDto,
    pdfKey: string,
    thumbnailKey: string | null,
  ): Promise<void> {
    await this.orderRepository.updateOrderById(id, {
      generationStatus: GenerationStatus.COMPLETED,
      planJson: JSON.stringify(plan),
      pdfKey,
      thumbnailKey,
    });
  }

  async recordFailedAttempt(id: string): Promise<void> {
    await this.orderRepository.incrementOrderFailedAttempt(id);
  }
}
