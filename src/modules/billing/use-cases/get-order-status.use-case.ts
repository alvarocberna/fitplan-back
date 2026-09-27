import { Injectable, NotFoundException } from '@nestjs/common';
import { NutritionPlanDto, OrderStatusDto } from '../../../domain';
import { FileStorage } from '../../../domain/ports';
import { OrderRepository } from '../../../domain/repositories/commercial-domain/order.repository';
import { CognitoUserClaims } from '../../../common/auth/cognito-user.decorator';
import { CurrentUserResolver } from '../../identity/current-user.resolver';
import { signPlanFiles } from '../order-files';

// CU-BIL-03. El frontend hace polling a GET /orders/:id/status mientras se paga y genera el plan.
@Injectable()
export class GetOrderStatusUseCase {
  constructor(
    private readonly currentUser: CurrentUserResolver,
    private readonly orderRepository: OrderRepository,
    private readonly fileStorage: FileStorage,
  ) {}

  // R2: valida que la orden pertenezca al usuario del token (anti-BOLA). Responde 404 tanto si no
  // existe como si es de otro usuario, para no filtrar cuál de los dos casos es.
  async execute(input: {
    claims: CognitoUserClaims;
    orderId: string;
  }): Promise<OrderStatusDto> {
    const user = await this.currentUser.resolve(input.claims);
    const order = await this.orderRepository.getOrderById(input.orderId);
    if (!order || order.userId !== user.id) {
      throw new NotFoundException(`Orden ${input.orderId} no encontrada`);
    }

    const { pdfUrl, thumbnailUrl } = await signPlanFiles(this.fileStorage, order);

    return {
      paymentStatus: order.paymentStatus,
      generationStatus: order.generationStatus,
      planJson: order.planJson
        ? (JSON.parse(order.planJson) as NutritionPlanDto)
        : null,
      pdfUrl,
      thumbnailUrl,
    };
  }
}
