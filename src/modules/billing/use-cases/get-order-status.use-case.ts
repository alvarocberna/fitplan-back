import { Injectable, NotFoundException } from '@nestjs/common';
import { OrderStatusDto } from '../../../domain';
import { GenerationStatus, PaymentStatus } from '../../../domain/entities/enums';
import { parsePlanJson } from '../../../domain/services/utils/plan-json';
import { isGenerationRetryPending } from '../../../domain/services/orders/generation-retry.policy';
import { FileStorage } from '../../../domain/ports';
import { OrderRepository } from '../../../domain/repositories/commercial-domain/order.repository';
import { CognitoUserClaims } from '../../../common/auth/cognito-user.decorator';
import { CurrentUserResolver } from '../../identity/current-user.resolver';
import { signPlanFiles } from '../order-files';
import { OrderLifecycleService } from '../order-lifecycle.service';

// CU-BIL-03. El frontend hace polling a GET /orders/:id/status mientras se paga y genera el plan.
@Injectable()
export class GetOrderStatusUseCase {
  constructor(
    private readonly currentUser: CurrentUserResolver,
    private readonly orderRepository: OrderRepository,
    private readonly orderLifecycle: OrderLifecycleService,
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

    // Si el plazo de pago venció y el job todavía no pasó, la orden se expira acá: el frontend
    // nunca ve como pagable una orden vencida.
    const expired = await this.orderLifecycle.isExpired(order);

    const { pdfUrl, thumbnailUrl } = await signPlanFiles(this.fileStorage, order);

    return {
      paymentStatus: expired ? PaymentStatus.EXPIRED : order.paymentStatus,
      expirationDate: order.expirationDate?.toISOString() ?? null,
      // Un fallo con reintentos automáticos pendientes se informa como GENERATING: el usuario solo ve
      // el error cuando es definitivo.
      generationStatus: isGenerationRetryPending(order)
        ? GenerationStatus.GENERATING
        : order.generationStatus,
      // un plan_json corrupto no debe romper el polling: se informa sin detalle (el PDF sigue disponible)
      planJson: parsePlanJson(order.planJson),
      pdfUrl,
      thumbnailUrl,
    };
  }
}
