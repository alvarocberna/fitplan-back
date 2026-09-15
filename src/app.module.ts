import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ConsultationModule } from './presentation/consultation/consultation.module';
import { OpenaiModule } from './presentation/openai/openai.module';
import { PrismaModule } from './infrastructure/orm/prisma/prisma.module';
import { OrdersModule } from './presentation/orders/orders.module';
import { WebhooksModule } from './presentation/webhooks/webhooks.module';
import { UserModule } from './presentation/user/user.module';
import { PanelModule } from './presentation/panel/panel.module';
import { IdentityAuthDatasourcesModule } from './infrastructure/datasources/identity-auth/identity-auth-datasources.module';
import { IdentityAuthRepositoriesModule } from './infrastructure/repositories/identity-auth/identity-auth-repositories.module';
import { ClinicalDomainDatasourcesModule } from './infrastructure/datasources/clinical-domain/clinical-domain-datasources.module';
import { ClinicalDomainRepositoriesModule } from './infrastructure/repositories/clinical-domain/clinical-domain-repositories.module';
import { CommercialDomainDatasourcesModule } from './infrastructure/datasources/commercial-domain/commercial-domain-datasources.module';
import { CommercialDomainRepositoriesModule } from './infrastructure/repositories/commercial-domain/commercial-domain-repositories.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PrismaModule,
    ConsultationModule,
    OpenaiModule,
    IdentityAuthDatasourcesModule,
    IdentityAuthRepositoriesModule,
    ClinicalDomainDatasourcesModule,
    ClinicalDomainRepositoriesModule,
    CommercialDomainDatasourcesModule,
    CommercialDomainRepositoriesModule,
    OrdersModule,
    WebhooksModule,
    UserModule,
    PanelModule,
  ],
})
export class AppModule {}
