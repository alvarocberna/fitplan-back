import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { GenerationStatus } from '../../../domain';
import {
  PaymentProvider,
  PaymentTransactionStatus,
  ProductType,
} from '../../../domain/entities/enums';
import type { PaymentResultDto } from '../../../domain';
import type { OrderPaidExtras } from '../../../domain/datasources/commercial-domain/order.datasource';
import { OrderRepository } from '../../../domain/repositories/commercial-domain/order.repository';
import { ORDER_PAID, OrderPaidEvent } from '../events/order-paid.event';
import { ErrorCode } from '../../../common/errors/error-codes';
import type { CognitoUserClaims } from '../../../common/auth/cognito-user.decorator';
import { CurrentUserResolver } from '../../identity/current-user.resolver';
import { OrderLifecycleService } from '../order-lifecycle.service';

export type ConfirmPaymentResult = {
  status: 'processed' | 'already_processed';
};

// Intento de pago de la pasarela (fila payment INITIATED) y el resultado con que se cierra.
export interface SettledPayment {
  paymentId: string;
  result: PaymentResultDto;
}

// CU-BIL-02. Lo usan el retorno de Webpay (CommitWebpayPaymentUseCase, CU-BIL-07) y el simulador
// (POST /dev/orders/:id/simulate-payment).
@Injectable()
export class ConfirmPaymentUseCase {
  private readonly logger = new Logger(ConfirmPaymentUseCase.name);

  constructor(
    private readonly orderRepository: OrderRepository,
    private readonly orderLifecycle: OrderLifecycleService,
    private readonly eventEmitter: EventEmitter2,
    private readonly currentUser: CurrentUserResolver,
  ) {}

  // Idempotente: si la orden ya estaba pagada no crea otro payment ni vuelve a emitir order.paid.
  // Una orden rechazada se puede pagar (reintento); una expirada o con el plazo vencido no (409).
  // No espera a que termine lo que dispara el evento (la generación del plan corre en segundo
  // plano), para no bloquear la respuesta.
  // Con `claims` (pago simulado, lo dispara el propio usuario) la orden debe ser suya: 404 si no (R2).
  // Sin `claims` es el retorno de la pasarela (CommitWebpayPaymentUseCase), que ya verificó el cobro
  // con ella y pasa en `payment` el intento a completar.
  async execute(input: {
    orderId: string;
    claims?: CognitoUserClaims;
    payment?: SettledPayment;
  }): Promise<ConfirmPaymentResult> {
    const { orderId } = input;
    const order = await this.orderRepository.getOrderWithProductById(orderId);
    if (!order?.product)
      throw new NotFoundException(`Orden ${orderId} no encontrada`);
    if (input.claims) {
      const user = await this.currentUser.resolve(input.claims);
      if (order.userId !== user.id) {
        throw new NotFoundException(`Orden ${orderId} no encontrada`);
      }
    }
    const { product } = order;

    // Un plan estándar ya tiene su PDF: se copia desde el producto en la misma transacción que
    // marca el pago y la orden queda COMPLETED. Recién ahora que está pagada puede exponer el PDF
    // (GET /orders/:id/status, GET /me/plans).
    let extras: OrderPaidExtras | undefined;
    if (product.type === ProductType.PREDEFINED) {
      if (!product.pdfKey) {
        throw new Error(
          `Producto ${product.id} (PREDEFINED) sin pdfKey: no se puede entregar la orden ${orderId}`,
        );
      }
      extras = {
        pdfKey: product.pdfKey,
        thumbnailKey: product.thumbnailKey,
        generationStatus: GenerationStatus.COMPLETED,
      };
    }

    // En UNA transacción: paymentStatus PENDING|REJECTED -> PAID (solo si seguía pagable) + fila payment
    // AUTHORIZED. Con `payment` (pasarela real) se completa el intento INITIATED con el resultado que
    // informó la pasarela; sin él es el pago simulado y los campos de detalle son placeholders.
    const markedNow = await this.orderRepository.markOrderAsPaidWithPayment(
      orderId,
      input.payment?.result ?? {
        provider: PaymentProvider.SIMULATED,
        paymentIdentifier: `SIM-${orderId}`,
        authorizationCode: 'SIMULATED',
        amount: order.amount,
        installmentCount: 1,
        status: PaymentTransactionStatus.AUTHORIZED,
        transactionDate: new Date(),
        movementType: 'SIMULATED',
        cardType: 'SIMULATED',
      },
      extras,
      input.payment?.paymentId,
    );

    if (!markedNow) {
      // La orden no era pagable: o venció su plazo, o ya estaba pagada.
      if (await this.orderLifecycle.isExpired(order)) {
        this.logger.warn(
          `Orden ${orderId}: pago recibido pero la orden expiró`,
        );
        throw new ConflictException({
          code: ErrorCode.ORDER_EXPIRED,
          message: 'La orden expiró sin pagarse',
        });
      }
      this.logger.log(
        `Orden ${orderId}: pago recibido pero ya estaba pagada (ignorado)`,
      );
      return { status: 'already_processed' };
    }

    const event: OrderPaidEvent = { orderId, productType: product.type };
    this.eventEmitter.emit(ORDER_PAID, event);
    this.logger.log(
      `Orden ${orderId}: pago confirmado (producto ${product.type})`,
    );
    return { status: 'processed' };
  }
}
