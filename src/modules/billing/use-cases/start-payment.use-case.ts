import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import {
  PaymentProvider,
  PaymentStatus,
  PaymentTransactionStatus,
} from '../../../domain/entities/enums';
import { PaymentGateway } from '../../../domain/ports';
import { OrderRepository } from '../../../domain/repositories/commercial-domain/order.repository';
import { PaymentRepository } from '../../../domain/repositories/commercial-domain/payment.repository';
import { ErrorCode } from '../../../common/errors/error-codes';
import type { CognitoUserClaims } from '../../../common/auth/cognito-user.decorator';
import { CurrentUserResolver } from '../../identity/current-user.resolver';
import { OrderLifecycleService } from '../order-lifecycle.service';

export interface StartPaymentResult {
  // URL del formulario de Webpay: el navegador debe enviarle `token` como token_ws.
  url: string;
  token: string;
}

// Tiempo mínimo que debe quedarle a la orden al abrir el checkout: cubre lo que el usuario puede
// tardar en el formulario de la pasarela, para que un cobro aprobado no encuentre la orden expirada.
export const CHECKOUT_MIN_WINDOW_MS = 15 * 60 * 1000;

// Moneda que acepta Webpay Plus.
const GATEWAY_CURRENCY = 'CLP';

// CU-BIL-06. POST /orders/:id/payments: inicia un pago de la orden en la pasarela.
@Injectable()
export class StartPaymentUseCase {
  private readonly logger = new Logger(StartPaymentUseCase.name);

  constructor(
    private readonly currentUser: CurrentUserResolver,
    private readonly orderRepository: OrderRepository,
    private readonly paymentRepository: PaymentRepository,
    private readonly orderLifecycle: OrderLifecycleService,
    private readonly paymentGateway: PaymentGateway,
  ) {}

  // Cada llamada crea un intento nuevo (fila payment INITIATED): un intento abandonado o rechazado no
  // impide reintentar. El monto sale de la orden, nunca del cliente (R3).
  async execute(input: {
    claims: CognitoUserClaims;
    orderId: string;
  }): Promise<StartPaymentResult> {
    const { orderId } = input;
    const user = await this.currentUser.resolve(input.claims);
    const order = await this.orderRepository.getOrderById(orderId);
    // R2: 404 tanto si no existe como si es de otro usuario.
    if (!order || order.userId !== user.id) {
      throw new NotFoundException(`Orden ${orderId} no encontrada`);
    }

    if (order.paymentStatus === PaymentStatus.PAID) {
      throw new ConflictException({
        code: ErrorCode.ORDER_ALREADY_PAID,
        message: 'Esta orden ya está pagada',
      });
    }
    if (await this.orderLifecycle.isExpired(order)) {
      throw new ConflictException({
        code: ErrorCode.ORDER_EXPIRED,
        message: 'La orden expiró sin pagarse',
      });
    }
    if (order.currency !== GATEWAY_CURRENCY) {
      throw new Error(
        `Orden ${orderId}: moneda ${order.currency} no soportada por la pasarela`,
      );
    }

    const minExpiration = new Date(Date.now() + CHECKOUT_MIN_WINDOW_MS);
    if (order.expirationDate && order.expirationDate < minExpiration) {
      await this.orderRepository.updateOrderById(orderId, {
        expirationDate: minExpiration,
      });
    }

    // 26 caracteres hexadecimales: el máximo que admite Webpay para la orden de compra.
    const buyOrder = randomBytes(13).toString('hex');
    const amount = Math.round(order.amount);
    const transaction = await this.paymentGateway.createTransaction({
      buyOrder,
      sessionId: user.id,
      amount,
    });

    await this.paymentRepository.createPayment({
      orderId,
      provider: PaymentProvider.TRANSBANK,
      paymentIdentifier: buyOrder,
      token: transaction.token,
      amount,
      status: PaymentTransactionStatus.INITIATED,
    });

    this.logger.log(
      `Orden ${orderId}: pago iniciado en la pasarela (${buyOrder})`,
    );
    return { url: transaction.redirectUrl, token: transaction.token };
  }
}
