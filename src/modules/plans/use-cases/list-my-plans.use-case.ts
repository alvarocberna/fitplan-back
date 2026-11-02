import { Injectable } from '@nestjs/common';
import { FileStorage } from '../../../domain/ports';
import { OrderRepository } from '../../../domain/repositories/commercial-domain/order.repository';
import { CognitoUserClaims } from '../../../common/auth/cognito-user.decorator';
import { CurrentUserResolver } from '../../identity/current-user.resolver';
import { signPlanFiles } from '../../billing/order-files';
import { MyPlanSummaryDto } from '../dto/my-plan.dto';
import { planNameOf, purchasedAtOf, summaryOf } from '../my-plan.mapper';

// CU-PLN-04. Planes del usuario autenticado (estándar y personalizados) con PDF disponible, más
// nuevo primero, con su resumen (objetivo, régimen, ingesta). Filtra siempre por el usuario del
// token, no recibe ningún id externo.
@Injectable()
export class ListMyPlansUseCase {
  constructor(
    private readonly currentUser: CurrentUserResolver,
    private readonly orderRepository: OrderRepository,
    private readonly fileStorage: FileStorage,
  ) {}

  async execute(input: {
    claims: CognitoUserClaims;
  }): Promise<MyPlanSummaryDto[]> {
    const user = await this.currentUser.resolve(input.claims);
    const orders = await this.orderRepository.getPaidOrdersWithPdfByUserId(
      user.id,
    );

    return Promise.all(
      orders.map(async (order) => {
        const { pdfUrl, thumbnailUrl } = await signPlanFiles(
          this.fileStorage,
          order,
        );
        return {
          orderId: order.id,
          type: order.product!.type,
          name: planNameOf(order),
          purchasedAt: purchasedAtOf(order),
          // el repositorio solo devuelve órdenes con pdfKey, así que siempre hay URL
          pdfUrl: pdfUrl!,
          thumbnailUrl,
          summary: summaryOf(order),
        };
      }),
    );
  }
}
