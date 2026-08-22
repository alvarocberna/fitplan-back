import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ConsultationModule } from './presentation/consultation/consultation.module';
import { OpenaiModule } from './presentation/openai/openai.module';
import { PrismaModule } from './infrastructure/orm/prisma/prisma.module';
import { OrdersModule } from './presentation/orders/orders.module';
import { WebhooksModule } from './presentation/webhooks/webhooks.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PrismaModule,
    ConsultationModule,
    OpenaiModule,
    OrdersModule,
    WebhooksModule,
  ],
})
export class AppModule {}
