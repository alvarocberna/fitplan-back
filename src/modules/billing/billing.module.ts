import { Module } from '@nestjs/common';
import { CommercialDomainRepositoriesModule } from '../../infrastructure/persistence/repositories/commercial-domain/commercial-domain-repositories.module';
import { FileStorageModule } from '../../infrastructure/storage/s3/s3-file-storage.module';
import { IdentityModule } from '../identity/identity.module';
import { OrdersController } from './orders.controller';
import {
  DevPaymentsController,
  PaymentsWebhookController,
} from './payments.controller';
import { PaymentSimulationEnabledGuard } from './payment-simulation-enabled.guard';
import { OrderLifecycleService } from './order-lifecycle.service';
import { CreateOrderUseCase } from './use-cases/create-order.use-case';
import { ConfirmPaymentUseCase } from './use-cases/confirm-payment.use-case';
import { GetOrderStatusUseCase } from './use-cases/get-order-status.use-case';

// Ciclo de vida de la orden, pagos y webhooks. No depende de consultation ni de plans: avisa del
// pago emitiendo order.paid (ver events/order-paid.event.ts).
@Module({
  imports: [CommercialDomainRepositoriesModule, FileStorageModule, IdentityModule],
  controllers: [OrdersController, PaymentsWebhookController, DevPaymentsController],
  providers: [
    PaymentSimulationEnabledGuard,
    OrderLifecycleService,
    CreateOrderUseCase,
    ConfirmPaymentUseCase,
    GetOrderStatusUseCase,
  ],
  exports: [CreateOrderUseCase, OrderLifecycleService],
})
export class BillingModule {}
