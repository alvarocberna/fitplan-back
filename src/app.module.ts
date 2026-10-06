import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';
import { DEFAULT_THROTTLERS } from './common/throttling/throttle-limits';
import { UserThrottlerGuard } from './common/throttling/user-throttler.guard';
import { PrismaModule } from './infrastructure/persistence/orm/prisma/prisma.module';
import { IdentityModule } from './modules/identity/identity.module';
import { ConsultationModule } from './modules/consultation/consultation.module';
import { PlansModule } from './modules/plans/plans.module';
import { BillingModule } from './modules/billing/billing.module';
import { ClinicalModule } from './modules/clinical/clinical.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    // order.paid (billing -> plans) y order.expired (billing -> consultation), ver
    // modules/billing/events/
    EventEmitterModule.forRoot(),
    // job de expiración de órdenes sin pagar (modules/billing/jobs/expire-unpaid-orders.job.ts)
    ScheduleModule.forRoot(),
    // rate limiting global por (endpoint, usuario); los límites están en common/throttling
    ThrottlerModule.forRoot({ throttlers: DEFAULT_THROTTLERS }),
    PrismaModule,
    IdentityModule,
    ConsultationModule,
    PlansModule,
    BillingModule,
    ClinicalModule,
  ],
  providers: [
    UserThrottlerGuard,
    { provide: APP_GUARD, useExisting: UserThrottlerGuard },
  ],
})
export class AppModule {}
