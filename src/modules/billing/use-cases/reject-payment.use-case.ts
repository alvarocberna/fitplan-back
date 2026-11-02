import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  PaymentProvider,
  PaymentTransactionStatus,
} from '../../../domain/entities/enums';
import { OrderRepository } from '../../../domain/repositories/commercial-domain/order.repository';
import { ErrorCode } from '../../../common/errors/error-codes';
import type { CognitoUserClaims } from '../../../common/auth/cognito-user.decorator';
import { CurrentUserResolver } from '../../identity/current-user.resolver';
import { OrderLifecycleService } from '../order-lifecycle.service';
import type { SettledPayment } from './confirm-payment.use-case';

export type RejectPaymentResult = { status: 'rejected' | 'already_processed' };

// CU-BIL-04. Lo usan el retorno de Webpay cuando el pago fue rechazado (CommitWebpayPaymentUseCase,
// CU-BIL-07) y el simulador (POST /dev/orders/:id/simulate-payment-rejection).
@Injectable()
export class RejectPaymentUseCase {
  private readonly logger = new Logger(RejectPaymentUseCase.name);

  constructor(
    private readonly orderRepository: OrderRepository,
    private readonly orderLifecycle: OrderLifecycleService,
    private readonly currentUser: CurrentUserResolver,
  ) {}

  // Deja registro del intento (fila payment REJECTED) y la orden en REJECTED, que sigue siendo
  // pagable: el usuario puede reintentar hasta que venza el plazo de la orden (el rechazo no lo
  // reinicia). Cada rechazo crea su propia fila payment.
  // Con `claims` (rechazo simulado por el propio usuario) la orden debe ser suya: 404 si no (R2).
  // Sin `claims` es el retorno de la pasarela, que pasa en `payment` el intento a completar.
  async execute(input: {
    orderId: string;
    claims?: CognitoUserClaims;
    payment?: SettledPayment;
  }): Promise<RejectPaymentResult> {
    const { orderId } = input;
    const order = await this.orderRepository.getOrderById(orderId);
    if (!order) throw new NotFoundException(`Orden ${orderId} no encontrada`);
    if (input.claims) {
      const user = await this.currentUser.resolve(input.claims);
      if (order.userId !== user.id) {
        throw new NotFoundException(`Orden ${orderId} no encontrada`);
      }
    }

    // En UNA transacción: paymentStatus PENDING|REJECTED -> REJECTED (solo si seguía pagable) + fila
    // payment REJECTED. Con `payment` (pasarela real) se completa el intento INITIATED con el resultado
    // que informó la pasarela; sin él es el rechazo simulado y los campos de detalle son placeholders.
    const markedNow = await this.orderRepository.markOrderAsRejectedWithPayment(
      orderId,
      input.payment?.result ?? {
        provider: PaymentProvider.SIMULATED,
        paymentIdentifier: `SIM-${orderId}`,
        authorizationCode: 'SIMULATED',
        amount: order.amount,
        installmentCount: 1,
        status: PaymentTransactionStatus.REJECTED,
        transactionDate: new Date(),
        movementType: 'SIMULATED',
        cardType: 'SIMULATED',
      },
      input.payment?.paymentId,
    );

    if (!markedNow) {
      // La orden no admitía pagos: o venció su plazo, o ya estaba pagada.
      if (await this.orderLifecycle.isExpired(order)) {
        throw new ConflictException({
          code: ErrorCode.ORDER_EXPIRED,
          message: 'La orden expiró sin pagarse',
        });
      }
      this.logger.log(
        `Orden ${orderId}: rechazo recibido pero ya estaba pagada (ignorado)`,
      );
      return { status: 'already_processed' };
    }

    this.logger.log(`Orden ${orderId}: pago rechazado`);
    return { status: 'rejected' };
  }
}
