import { NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ConfirmPaymentUseCase } from './confirm-payment.use-case';
import { OrderRepository } from '../../../domain/repositories/commercial-domain/order.repository';
import { ORDER_PAID } from '../events/order-paid.event';

describe('ConfirmPaymentUseCase', () => {
  let useCase: ConfirmPaymentUseCase;
  let orderRepository: {
    getOrderWithProductById: jest.Mock;
    markOrderAsPaidWithPayment: jest.Mock;
  };
  let eventEmitter: { emit: jest.Mock };

  const generatedOrder = {
    id: 'order-1',
    amount: 19990,
    product: { id: 'product-1', type: 'GENERATED', pdfKey: null, thumbnailKey: null },
  };
  const predefinedOrder = {
    id: 'order-2',
    amount: 14990,
    product: {
      id: 'product-2',
      type: 'PREDEFINED',
      pdfKey: 'productos-estandarizados/plan-gimnasio-volumen-50-60-m-joven.pdf',
      thumbnailKey: 'productos-estandarizados/miniaturas/plan-gimnasio-volumen-50-60-m-joven.webp',
    },
  };

  beforeEach(() => {
    orderRepository = {
      getOrderWithProductById: jest.fn(),
      markOrderAsPaidWithPayment: jest.fn(),
    };
    eventEmitter = { emit: jest.fn() };
    useCase = new ConfirmPaymentUseCase(
      orderRepository as unknown as OrderRepository,
      eventEmitter as unknown as EventEmitter2,
    );
  });

  it('verifyWebhookSignature siempre devuelve true (placeholder, sin pasarela real todavía)', () => {
    expect(useCase.verifyWebhookSignature()).toBe(true);
  });

  it('lanza NotFoundException si la orden no existe, sin marcar el pago ni emitir el evento', async () => {
    orderRepository.getOrderWithProductById.mockResolvedValue(null);

    await expect(useCase.execute({ orderId: 'missing' })).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(orderRepository.markOrderAsPaidWithPayment).not.toHaveBeenCalled();
    expect(eventEmitter.emit).not.toHaveBeenCalled();
  });

  it('GENERATED: crea el payment AUTHORIZED con el monto de la orden, sin tocar pdfKey, y emite order.paid', async () => {
    orderRepository.getOrderWithProductById.mockResolvedValue(generatedOrder);
    orderRepository.markOrderAsPaidWithPayment.mockResolvedValue(true);

    await expect(useCase.execute({ orderId: 'order-1' })).resolves.toEqual({
      status: 'processed',
    });

    expect(orderRepository.markOrderAsPaidWithPayment).toHaveBeenCalledWith(
      'order-1',
      expect.objectContaining({
        provider: 'SIMULATED',
        paymentIdentifier: 'SIM-order-1',
        amount: 19990,
        status: 'AUTHORIZED',
        transactionDate: expect.any(Date),
      }),
      undefined,
    );
    expect(eventEmitter.emit).toHaveBeenCalledWith(ORDER_PAID, {
      orderId: 'order-1',
      productType: 'GENERATED',
    });
  });

  it('PREDEFINED: copia pdfKey y thumbnailKey del producto, deja la orden completada y emite order.paid', async () => {
    orderRepository.getOrderWithProductById.mockResolvedValue(predefinedOrder);
    orderRepository.markOrderAsPaidWithPayment.mockResolvedValue(true);

    await expect(useCase.execute({ orderId: 'order-2' })).resolves.toEqual({
      status: 'processed',
    });

    expect(orderRepository.markOrderAsPaidWithPayment).toHaveBeenCalledWith(
      'order-2',
      expect.objectContaining({ amount: 14990, status: 'AUTHORIZED' }),
      {
        pdfKey: 'productos-estandarizados/plan-gimnasio-volumen-50-60-m-joven.pdf',
        thumbnailKey: 'productos-estandarizados/miniaturas/plan-gimnasio-volumen-50-60-m-joven.webp',
        generationStatus: 'COMPLETED',
      },
    );
    expect(eventEmitter.emit).toHaveBeenCalledWith(ORDER_PAID, {
      orderId: 'order-2',
      productType: 'PREDEFINED',
    });
  });

  it('PREDEFINED sin pdfKey: falla sin marcar el pago', async () => {
    orderRepository.getOrderWithProductById.mockResolvedValue({
      ...predefinedOrder,
      product: { ...predefinedOrder.product, pdfKey: null },
    });

    await expect(useCase.execute({ orderId: 'order-2' })).rejects.toThrow(/sin pdfKey/);
    expect(orderRepository.markOrderAsPaidWithPayment).not.toHaveBeenCalled();
    expect(eventEmitter.emit).not.toHaveBeenCalled();
  });

  it('idempotente: si la orden ya estaba pagada responde already_processed y no emite el evento', async () => {
    orderRepository.getOrderWithProductById.mockResolvedValue(generatedOrder);
    orderRepository.markOrderAsPaidWithPayment.mockResolvedValue(false);

    await expect(useCase.execute({ orderId: 'order-1' })).resolves.toEqual({
      status: 'already_processed',
    });
    expect(eventEmitter.emit).not.toHaveBeenCalled();
  });
});
