import { Injectable } from '@nestjs/common';
import { GenerationStatus } from '../../../domain';
import { PaymentStatus } from '../../../domain/entities/enums';
import { OrderEntity } from '../../../domain/entities/order.entity';
import { ProductEntity } from '../../../domain/entities/product.entity';
import { OrderRepository } from '../../../domain/repositories/commercial-domain/order.repository';

// CU-BIL-01 (interno, sin endpoint). Única forma de crear órdenes: la usan la creación de consulta
// (consultation) y la compra de un plan estándar (plans). Monto y moneda salen siempre del producto
// (R3), nunca del frontend. La orden nace pendiente de pago y sin archivos: para un plan estándar el
// PDF se copia recién al confirmarse el pago (ConfirmPaymentUseCase).
@Injectable()
export class CreateOrderUseCase {
  constructor(private readonly orderRepository: OrderRepository) {}

  execute(input: {
    userId: string;
    product: Pick<ProductEntity, 'id' | 'price' | 'currency'>;
  }): Promise<OrderEntity> {
    return this.orderRepository.createOrder({
      userId: input.userId,
      productId: input.product.id,
      amount: input.product.price,
      currency: input.product.currency,
      paymentStatus: PaymentStatus.PENDING,
      generationStatus: GenerationStatus.NOT_STARTED,
      planJson: null,
      pdfKey: null,
      thumbnailKey: null,
      attempts: 0,
      creationDate: new Date(),
      paymentDate: null,
      expirationDate: null,
    });
  }
}
