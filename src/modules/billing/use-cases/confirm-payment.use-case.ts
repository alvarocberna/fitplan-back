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
import type { OrderPaidExtras } from '../../../domain/datasources/commercial-domain/order.datasource';
import { OrderRepository } from '../../../domain/repositories/commercial-domain/order.repository';
import { ORDER_PAID, OrderPaidEvent } from '../events/order-paid.event';
import { ErrorCode } from '../../../common/errors/error-codes';
import { OrderLifecycleService } from '../order-lifecycle.service';

export type ConfirmPaymentResult = { status: 'processed' | 'already_processed' };

// CU-BIL-02. Lo usan el webhook de la pasarela (POST /webhooks/payments) y el simulador
// (POST /dev/orders/:id/simulate-payment).
@Injectable()
export class ConfirmPaymentUseCase {
  private readonly logger = new Logger(ConfirmPaymentUseCase.name);

  constructor(
    private readonly orderRepository: OrderRepository,
    private readonly orderLifecycle: OrderLifecycleService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  // Punto de extensión aislado para cuando se integre una pasarela real (Transbank): acá se debe
  // validar la firma/secreto del webhook contra el header que corresponda y devolver false si no
  // coincide. Como todavía no hay pasarela, se acepta siempre.
  verifyWebhookSignature(): boolean {
    return true;
  }

  // Idempotente: si la orden ya estaba pagada no crea otro payment ni vuelve a emitir order.paid.
  // Una orden rechazada se puede pagar (reintento); una expirada o con el plazo vencido no (409).
  // No espera a que termine lo que dispara el evento (la generación del plan corre en segundo
  // plano), para no bloquear al webhook.
  async execute(input: { orderId: string }): Promise<ConfirmPaymentResult> {
    const { orderId } = input;
    const order = await this.orderRepository.getOrderWithProductById(orderId);
    if (!order?.product) throw new NotFoundException(`Orden ${orderId} no encontrada`);
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
    // AUTHORIZED. El pago hoy es simulado: los campos de detalle son placeholders hasta integrar
    // una pasarela real (que los entregaría en su webhook).
    const markedNow = await this.orderRepository.markOrderAsPaidWithPayment(
      orderId,
      {
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
    );

    if (!markedNow) {
      // La orden no era pagable: o venció su plazo, o ya estaba pagada.
      if (await this.orderLifecycle.isExpired(order)) {
        this.logger.warn(`Orden ${orderId}: pago recibido pero la orden expiró`);
        throw new ConflictException({
          code: ErrorCode.ORDER_EXPIRED,
          message: 'La orden expiró sin pagarse',
        });
      }
      this.logger.log(`Orden ${orderId}: pago recibido pero ya estaba pagada (ignorado)`);
      return { status: 'already_processed' };
    }

    const event: OrderPaidEvent = { orderId, productType: product.type };
    this.eventEmitter.emit(ORDER_PAID, event);
    this.logger.log(`Orden ${orderId}: pago confirmado (producto ${product.type})`);
    return { status: 'processed' };
  }
}
