import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ConsultaModule } from './presentation/consulta/consulta.module';
import { OpenaiModule } from './presentation/openai/openai.module';
import { PrismaModule } from './infrastructure/orm/prisma/prisma.module';
import { OrdenesModule } from './presentation/ordenes/ordenes.module';
import { WebhooksModule } from './presentation/webhooks/webhooks.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PrismaModule,
    ConsultaModule,
    OpenaiModule,
    OrdenesModule,
    WebhooksModule,
  ],
})
export class AppModule {}
