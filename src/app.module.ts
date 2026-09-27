import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { PrismaModule } from './infrastructure/persistence/orm/prisma/prisma.module';
import { IdentityModule } from './modules/identity/identity.module';
import { ConsultationModule } from './modules/consultation/consultation.module';
import { PlansModule } from './modules/plans/plans.module';
import { BillingModule } from './modules/billing/billing.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    // order.paid (billing -> plans), ver modules/billing/events/order-paid.event.ts
    EventEmitterModule.forRoot(),
    PrismaModule,
    IdentityModule,
    ConsultationModule,
    PlansModule,
    BillingModule,
  ],
})
export class AppModule {}
