import { Module } from '@nestjs/common';
import { LlmModule } from '../../infrastructure/llm/openai/openai-llm.module';
import { ClinicalDomainRepositoriesModule } from '../../infrastructure/persistence/repositories/clinical-domain/clinical-domain-repositories.module';
import { CommercialDomainRepositoriesModule } from '../../infrastructure/persistence/repositories/commercial-domain/commercial-domain-repositories.module';
import { IdentityModule } from '../identity/identity.module';
import { BillingModule } from '../billing/billing.module';
import { ConsultationsController } from './consultations.controller';
import { ChatAnamnesisUseCase } from './use-cases/chat-anamnesis.use-case';
import { CreateConsultationUseCase } from './use-cases/create-consultation.use-case';
import { EvaluateGoalFeasibilityUseCase } from './use-cases/evaluate-goal-feasibility.use-case';
import { DeleteExpiredConsultationUseCase } from './use-cases/delete-expired-consultation.use-case';
import { PurgeExpiredConsultationsUseCase } from './use-cases/purge-expired-consultations.use-case';
import { OrderExpiredListener } from './listeners/order-expired.listener';
import { PurgeExpiredConsultationsJob } from './jobs/purge-expired-consultations.job';

@Module({
  imports: [
    LlmModule,
    ClinicalDomainRepositoriesModule,
    CommercialDomainRepositoriesModule,
    IdentityModule,
    BillingModule,
  ],
  controllers: [ConsultationsController],
  providers: [
    ChatAnamnesisUseCase,
    CreateConsultationUseCase,
    EvaluateGoalFeasibilityUseCase,
    DeleteExpiredConsultationUseCase,
    PurgeExpiredConsultationsUseCase,
    OrderExpiredListener,
    PurgeExpiredConsultationsJob,
  ],
})
export class ConsultationModule {}
