import { Injectable, NotFoundException } from '@nestjs/common';
import { ProductType } from '../../../domain/entities/enums';
import { FileStorage } from '../../../domain/ports';
import { OrderRepository } from '../../../domain/repositories/commercial-domain/order.repository';
import { CognitoUserClaims } from '../../../common/auth/cognito-user.decorator';
import { CurrentUserResolver } from '../../identity/current-user.resolver';
import { signPlanFiles } from '../../billing/order-files';
import { MyPlanDetailDto } from '../dto/my-plan.dto';
import {
  generatedDetailOf,
  planNameOf,
  productSummaryOf,
  purchasedAtOf,
} from '../my-plan.mapper';

// CU-PLN-05. Detalle de solo lectura de un plan del usuario autenticado, identificado por su orden
// (lo único común a planes personalizados y estándar). Inexistente, ajeno o no listo -> 404 (R2).
@Injectable()
export class GetMyPlanUseCase {
  constructor(
    private readonly currentUser: CurrentUserResolver,
    private readonly orderRepository: OrderRepository,
    private readonly fileStorage: FileStorage,
  ) {}

  async execute(input: {
    claims: CognitoUserClaims;
    orderId: string;
  }): Promise<MyPlanDetailDto> {
    const user = await this.currentUser.resolve(input.claims);
    const order = await this.orderRepository.getReadyOrderWithPlanDetailByIdAndUserId(
      input.orderId,
      user.id,
    );
    if (!order) throw new NotFoundException('Plan no encontrado');

    const { pdfUrl, thumbnailUrl } = await signPlanFiles(this.fileStorage, order);
    const product = order.product!;
    const isPredefined = product.type === ProductType.PREDEFINED;

    return {
      orderId: order.id,
      type: product.type,
      name: planNameOf(order),
      purchasedAt: purchasedAtOf(order),
      // el repositorio solo devuelve órdenes con pdfKey, así que siempre hay URL
      pdfUrl: pdfUrl!,
      thumbnailUrl,
      generated: isPredefined ? null : generatedDetailOf(order),
      predefined: isPredefined
        ? { description: product.description, summary: productSummaryOf(product) }
        : null,
    };
  }
}
