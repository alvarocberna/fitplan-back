import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { PaymentResultDto } from '../../../domain';
import {
  PaymentProvider,
  PaymentStatus,
  PaymentTransactionStatus,
  ProductType,
} from '../../../domain/entities/enums';
import type { PaymentEntity } from '../../../domain/entities/payment.entity';
import { PaymentGatewayUnavailableError } from '../../../domain/errors/payment.errors';
import {
  AlertNotifier,
  PaymentGateway,
  PaymentGatewayTransaction,
} from '../../../domain/ports';
import { OrderRepository } from '../../../domain/repositories/commercial-domain/order.repository';
import { PaymentRepository } from '../../../domain/repositories/commercial-domain/payment.repository';
import { OrderLifecycleService } from '../order-lifecycle.service';
import { ConfirmPaymentUseCase } from './confirm-payment.use-case';
import { RejectPaymentUseCase } from './reject-payment.use-case';

// paid: cobro confirmado y orden pagada. rejected: la pasarela rechazó el pago. cancelled: el usuario
// anuló o dejó vencer el formulario. not_committed: el usuario pagó pero la orden ya no admitía el
// pago, así que no se confirmó (no hay cobro). needs_review: cobro confirmado que no se pudo aplicar
// a la orden (requiere intervención manual).
export type WebpayPaymentOutcome =
  | 'paid'
  | 'rejected'
  | 'cancelled'
  | 'not_committed'
  | 'needs_review';

export interface CommitWebpayPaymentResult {
  orderId: string;
  productType: ProductType;
  outcome: WebpayPaymentOutcome;
}

// Parámetros con que Webpay devuelve al usuario: token_ws si llegó a pagar (aprobado o rechazado),
// TBK_TOKEN si anuló en el formulario, y solo TBK_ORDEN_COMPRA si el formulario venció.
export interface CommitWebpayPaymentInput {
  tokenWs?: string;
  tbkToken?: string;
  tbkBuyOrder?: string;
}

// Resultado que se informa cuando el intento ya estaba cerrado (recarga de la URL de retorno).
const OUTCOME_BY_STATUS: Record<
  PaymentTransactionStatus,
  WebpayPaymentOutcome
> = {
  [PaymentTransactionStatus.INITIATED]: 'cancelled',
  [PaymentTransactionStatus.AUTHORIZED]: 'paid',
  [PaymentTransactionStatus.REJECTED]: 'rejected',
  [PaymentTransactionStatus.CANCELLED]: 'cancelled',
};

// Estado de Webpay de una transacción que el usuario todavía no paga.
const GATEWAY_STATUS_INITIALIZED = 'INITIALIZED';

// CU-BIL-07. POST /payments/webpay/commit: cierra un intento de pago cuando Webpay devuelve al
// usuario. No hay sesión (el retorno es una redirección entre sitios y la cookie puede no viajar): el
// llamador se identifica por el token de la transacción, que solo conocen el backend y quien pagó.
// Los parámetros de retorno solo sirven para ubicar el intento; el resultado se le pregunta a
// Transbank.
@Injectable()
export class CommitWebpayPaymentUseCase {
  private readonly logger = new Logger(CommitWebpayPaymentUseCase.name);

  constructor(
    private readonly orderRepository: OrderRepository,
    private readonly paymentRepository: PaymentRepository,
    private readonly orderLifecycle: OrderLifecycleService,
    private readonly paymentGateway: PaymentGateway,
    private readonly confirmPayment: ConfirmPaymentUseCase,
    private readonly rejectPayment: RejectPaymentUseCase,
    private readonly alertNotifier: AlertNotifier,
  ) {}

  async execute(
    input: CommitWebpayPaymentInput,
  ): Promise<CommitWebpayPaymentResult> {
    const payment = await this.findPayment(input);
    if (!payment || payment.provider !== PaymentProvider.TRANSBANK) {
      throw new NotFoundException('Pago no encontrado');
    }
    const order = await this.orderRepository.getOrderWithProductById(
      payment.orderId,
    );
    if (!order?.product) throw new NotFoundException('Pago no encontrado');
    const { id: orderId } = order;
    const base = { orderId, productType: order.product.type };

    // Idempotente: recargar la URL de retorno no vuelve a confirmar ni a emitir order.paid.
    if (payment.status !== PaymentTransactionStatus.INITIATED) {
      return { ...base, outcome: OUTCOME_BY_STATUS[payment.status] };
    }

    // Anulado en el formulario (TBK_TOKEN) o formulario vencido (sin token_ws): no hay nada que
    // confirmar. La orden queda como estaba y se puede volver a intentar.
    if (!input.tokenWs || input.tbkToken) {
      await this.paymentRepository.closeInitiatedPayment(payment.id, {
        status: PaymentTransactionStatus.CANCELLED,
      });
      this.logger.log(
        `Orden ${orderId}: pago anulado o abandonado en la pasarela`,
      );
      return { ...base, outcome: 'cancelled' };
    }

    // La orden ya no admite este pago (la pagó otro intento, o expiró): no se confirma, y una
    // transacción sin confirmar no se cobra.
    if (
      order.paymentStatus === PaymentStatus.PAID ||
      (await this.orderLifecycle.isExpired(order))
    ) {
      await this.paymentRepository.closeInitiatedPayment(payment.id, {
        status: PaymentTransactionStatus.CANCELLED,
      });
      await this.alertNotifier.notify({
        event: 'payment_not_committed',
        severity: 'warning',
        message:
          'El usuario pagó en Webpay pero la orden ya no admitía el pago: no se confirmó la transacción',
        context: {
          orderId,
          paymentId: payment.id,
          orderPaymentStatus: order.paymentStatus,
        },
      });
      return { ...base, outcome: 'not_committed' };
    }

    const token = payment.token as string;
    const transaction = await this.commitOrReadStatus(token);
    if (transaction.buyOrder !== payment.paymentIdentifier) {
      await this.alertNotifier.notify({
        event: 'payment_mismatch',
        severity: 'critical',
        message:
          'La transacción que informó Webpay no corresponde al intento de pago',
        context: {
          orderId,
          paymentId: payment.id,
          gatewayBuyOrder: transaction.buyOrder,
        },
      });
      throw new Error(
        `Pago ${payment.id}: la orden de compra de Webpay no coincide`,
      );
    }

    const approved =
      transaction.approved && transaction.amount === payment.amount;
    const settled = {
      paymentId: payment.id,
      result: this.toResult(payment, transaction, approved),
    };

    if (!approved) {
      const rejected = await this.applyIfPayable(() =>
        this.rejectPayment.execute({ orderId, payment: settled }),
      );
      // La orden dejó de admitir pagos mientras tanto: igual queda registro del rechazo.
      if (rejected?.status !== 'rejected') {
        await this.paymentRepository.closeInitiatedPayment(
          payment.id,
          settled.result,
        );
      }
      return { ...base, outcome: 'rejected' };
    }

    const confirmed = await this.applyIfPayable(() =>
      this.confirmPayment.execute({ orderId, payment: settled }),
    );
    if (confirmed?.status === 'processed') return { ...base, outcome: 'paid' };

    // No fue esta llamada la que pagó la orden. Si otro retorno concurrente del mismo intento ya lo
    // cerró, está pagada con este mismo cobro.
    const current = await this.paymentRepository.getPaymentById(payment.id);
    if (current?.status === PaymentTransactionStatus.AUTHORIZED) {
      return { ...base, outcome: 'paid' };
    }

    // Cobro confirmado que no se aplicó: la orden expiró o la pagó otro intento entre la verificación
    // y el commit. Queda registrado y requiere devolver el dinero a mano.
    await this.paymentRepository.closeInitiatedPayment(
      payment.id,
      settled.result,
    );
    await this.alertNotifier.notify({
      event: 'payment_charged_not_applied',
      severity: 'critical',
      message:
        'Webpay confirmó un cobro que no se pudo aplicar a la orden: requiere reembolso',
      context: { orderId, paymentId: payment.id, amount: payment.amount },
    });
    return { ...base, outcome: 'needs_review' };
  }

  private findPayment(
    input: CommitWebpayPaymentInput,
  ): Promise<PaymentEntity | null> {
    if (input.tokenWs)
      return this.paymentRepository.getPaymentByToken(input.tokenWs);
    if (input.tbkToken)
      return this.paymentRepository.getPaymentByToken(input.tbkToken);
    if (input.tbkBuyOrder) {
      return this.paymentRepository.getPaymentByIdentifier(input.tbkBuyOrder);
    }
    return Promise.resolve(null);
  }

  // Una transacción solo se puede confirmar una vez. Si el commit falla (dos retornos a la vez, o se
  // perdió la respuesta de un commit que sí se hizo) se consulta su estado: si Webpay ya tiene un
  // resultado, se usa ese; si sigue sin pagar, el fallo era real.
  private async commitOrReadStatus(
    token: string,
  ): Promise<PaymentGatewayTransaction> {
    try {
      return await this.paymentGateway.commitTransaction(token);
    } catch (error) {
      if (!(error instanceof PaymentGatewayUnavailableError)) throw error;
      const status = await this.paymentGateway.getTransactionStatus(token);
      if (!status.status || status.status === GATEWAY_STATUS_INITIALIZED)
        throw error;
      return status;
    }
  }

  // Confirmar o rechazar responden 409 si la orden expiró justo antes: acá no es un error del
  // llamador, se resuelve según el caso.
  private async applyIfPayable<T>(apply: () => Promise<T>): Promise<T | null> {
    try {
      return await apply();
    } catch (error) {
      if (error instanceof ConflictException) return null;
      throw error;
    }
  }

  private toResult(
    payment: PaymentEntity,
    transaction: PaymentGatewayTransaction,
    approved: boolean,
  ): PaymentResultDto {
    return {
      provider: PaymentProvider.TRANSBANK,
      paymentIdentifier: payment.paymentIdentifier,
      amount: payment.amount,
      status: approved
        ? PaymentTransactionStatus.AUTHORIZED
        : PaymentTransactionStatus.REJECTED,
      responseCode: transaction.responseCode,
      authorizationCode: transaction.authorizationCode,
      installmentCount: transaction.installmentCount,
      transactionDate: transaction.transactionDate ?? new Date(),
      movementType: transaction.paymentTypeCode,
      cardType: this.cardType(transaction.paymentTypeCode),
      cardLastDigits: transaction.cardLastDigits,
    };
  }

  // VD = débito, VP = prepago; el resto de los tipos de pago de Webpay son crédito.
  private cardType(paymentTypeCode: string | null): string | null {
    if (!paymentTypeCode) return null;
    if (paymentTypeCode === 'VD') return 'DEBIT';
    if (paymentTypeCode === 'VP') return 'PREPAID';
    return 'CREDIT';
  }
}
