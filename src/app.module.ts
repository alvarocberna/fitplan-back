import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
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
    PrismaModule,
    IdentityModule,
    ConsultationModule,
    PlansModule,
    BillingModule,
    ClinicalModule,
  ],
})
export class AppModule {}
