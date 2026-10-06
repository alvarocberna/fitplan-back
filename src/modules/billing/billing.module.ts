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
import { PaymentWebhookVerifier } from './payment-webhook-verifier';
import { OrderLifecycleService } from './order-lifecycle.service';
import { CreateOrderUseCase } from './use-cases/create-order.use-case';
import { ConfirmPaymentUseCase } from './use-cases/confirm-payment.use-case';
import { GetOrderStatusUseCase } from './use-cases/get-order-status.use-case';
import { RejectPaymentUseCase } from './use-cases/reject-payment.use-case';
import { ExpireUnpaidOrdersUseCase } from './use-cases/expire-unpaid-orders.use-case';
import { ExpireUnpaidOrdersJob } from './jobs/expire-unpaid-orders.job';

// Ciclo de vida de la orden, pagos y webhooks. No depende de consultation ni de plans: avisa del
// pago emitiendo order.paid (ver events/order-paid.event.ts) y de la expiración de una orden sin
// pagar emitiendo order.expired (ver events/order-expired.event.ts).
@Module({
  imports: [CommercialDomainRepositoriesModule, FileStorageModule, IdentityModule],
  controllers: [OrdersController, PaymentsWebhookController, DevPaymentsController],
  providers: [
    PaymentSimulationEnabledGuard,
    PaymentWebhookVerifier,
    OrderLifecycleService,
    CreateOrderUseCase,
    ConfirmPaymentUseCase,
    GetOrderStatusUseCase,
    RejectPaymentUseCase,
    ExpireUnpaidOrdersUseCase,
    ExpireUnpaidOrdersJob,
  ],
  exports: [CreateOrderUseCase, OrderLifecycleService],
})
export class BillingModule {}
