import { Module } from '@nestjs/common';
import { LlmModule } from '../../infrastructure/llm/openai/openai-llm.module';
import { EmailModule } from '../../infrastructure/email/email.module';
import { PlanDocumentRendererModule } from '../../infrastructure/pdf/plan-document-renderer.module';
import { FileStorageModule } from '../../infrastructure/storage/s3/s3-file-storage.module';
import { ClinicalDomainRepositoriesModule } from '../../infrastructure/persistence/repositories/clinical-domain/clinical-domain-repositories.module';
import { CommercialDomainRepositoriesModule } from '../../infrastructure/persistence/repositories/commercial-domain/commercial-domain-repositories.module';
import { IdentityModule } from '../identity/identity.module';
import { BillingModule } from '../billing/billing.module';
import { StandardPlansController } from './standard-plans.controller';
import { MyPlansController } from './my-plans.controller';
import { OrderPaidListener } from './listeners/order-paid.listener';
import { ListStandardPlanPreviewsUseCase } from './use-cases/list-standard-plan-previews.use-case';
import { GetStandardPlanUseCase } from './use-cases/get-standard-plan.use-case';
import { PurchaseStandardPlanUseCase } from './use-cases/purchase-standard-plan.use-case';
import { ListMyPlansUseCase } from './use-cases/list-my-plans.use-case';
import { GetMyPlanUseCase } from './use-cases/get-my-plan.use-case';
import { GeneratePersonalizedPlanUseCase } from './use-cases/generate-personalized-plan.use-case';

// Planes desde la perspectiva del usuario: catálogo estándar, mis planes y generación del plan
// personalizado (disparada por el evento order.paid de billing).
@Module({
  imports: [
    LlmModule,
    EmailModule,
    PlanDocumentRendererModule,
    FileStorageModule,
    ClinicalDomainRepositoriesModule,
    CommercialDomainRepositoriesModule,
    IdentityModule,
    BillingModule,
  ],
  controllers: [StandardPlansController, MyPlansController],
  providers: [
    ListStandardPlanPreviewsUseCase,
    GetStandardPlanUseCase,
    PurchaseStandardPlanUseCase,
    ListMyPlansUseCase,
    GetMyPlanUseCase,
    GeneratePersonalizedPlanUseCase,
    OrderPaidListener,
  ],
})
export class PlansModule {}
