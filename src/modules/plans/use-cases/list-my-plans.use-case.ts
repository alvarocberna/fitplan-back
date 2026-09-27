import { Injectable } from '@nestjs/common';
import { OrderSummaryDto } from '../../../domain';
import { FileStorage } from '../../../domain/ports';
import { OrderRepository } from '../../../domain/repositories/commercial-domain/order.repository';
import { CognitoUserClaims } from '../../../common/auth/cognito-user.decorator';
import { CurrentUserResolver } from '../../identity/current-user.resolver';
import { signPlanFiles } from '../../billing/order-files';

// CU-PLN-04. Planes del usuario autenticado (estándar y personalizados) con PDF disponible, más
// nuevo primero. Filtra siempre por el usuario del token, no recibe ningún id externo.
@Injectable()
export class ListMyPlansUseCase {
  constructor(
    private readonly currentUser: CurrentUserResolver,
    private readonly orderRepository: OrderRepository,
    private readonly fileStorage: FileStorage,
  ) {}

  async execute(input: { claims: CognitoUserClaims }): Promise<OrderSummaryDto[]> {
    const user = await this.currentUser.resolve(input.claims);
    const orders = await this.orderRepository.getPaidOrdersWithPdfByUserId(user.id);

    return Promise.all(
      orders.map(async (order) => {
        const { pdfUrl, thumbnailUrl } = await signPlanFiles(this.fileStorage, order);
        return {
          orderId: order.id,
          creationDate: order.creationDate,
          // el repositorio solo devuelve órdenes con pdfKey, así que siempre hay URL
          pdfUrl: pdfUrl!,
          thumbnailUrl,
        };
      }),
    );
  }
}
