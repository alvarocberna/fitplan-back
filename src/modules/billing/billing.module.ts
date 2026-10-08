import { Module } from '@nestjs/common';
import { CommercialDomainRepositoriesModule } from '../../infrastructure/persistence/repositories/commercial-domain/commercial-domain-repositories.module';
import { FileStorageModule } from '../../infrastructure/storage/s3/s3-file-storage.module';
import { TransbankPaymentModule } from '../../infrastructure/payments/transbank/transbank-payment.module';
import { AlertsModule } from '../../infrastructure/alerts/alerts.module';
import { IdentityModule } from '../identity/identity.module';
import { OrdersController } from './orders.controller';
import { DevPaymentsController, PaymentsController } from './payments.controller';
import { PaymentSimulationEnabledGuard } from './payment-simulation-enabled.guard';
import { OrderLifecycleService } from './order-lifecycle.service';
import { CreateOrderUseCase } from './use-cases/create-order.use-case';
import { ConfirmPaymentUseCase } from './use-cases/confirm-payment.use-case';
import { GetOrderStatusUseCase } from './use-cases/get-order-status.use-case';
import { RejectPaymentUseCase } from './use-cases/reject-payment.use-case';
import { StartPaymentUseCase } from './use-cases/start-payment.use-case';
import { CommitWebpayPaymentUseCase } from './use-cases/commit-webpay-payment.use-case';
import { ExpireUnpaidOrdersUseCase } from './use-cases/expire-unpaid-orders.use-case';
import { ExpireUnpaidOrdersJob } from './jobs/expire-unpaid-orders.job';

// Ciclo de vida de la orden y pagos (Webpay Plus tras el puerto PaymentGateway). No depende de
// consultation ni de plans: avisa del pago emitiendo order.paid (ver events/order-paid.event.ts) y de
// la expiración de una orden sin pagar emitiendo order.expired (ver events/order-expired.event.ts).
@Module({
  imports: [
    CommercialDomainRepositoriesModule,
    FileStorageModule,
    TransbankPaymentModule,
    AlertsModule,
    IdentityModule,
  ],
  controllers: [OrdersController, PaymentsController, DevPaymentsController],
  providers: [
    PaymentSimulationEnabledGuard,
    OrderLifecycleService,
    CreateOrderUseCase,
    ConfirmPaymentUseCase,
    GetOrderStatusUseCase,
    RejectPaymentUseCase,
    StartPaymentUseCase,
    CommitWebpayPaymentUseCase,
    ExpireUnpaidOrdersUseCase,
    ExpireUnpaidOrdersJob,
  ],
  exports: [CreateOrderUseCase, OrderLifecycleService],
})
export class BillingModule {}
