import { Module } from '@nestjs/common';
import { IdentityAuthRepositoriesModule } from '../../infrastructure/persistence/repositories/identity-auth/identity-auth-repositories.module';
import { ClinicalDomainRepositoriesModule } from '../../infrastructure/persistence/repositories/clinical-domain/clinical-domain-repositories.module';
import { CurrentUserResolver } from './current-user.resolver';
import { MeController } from './me.controller';
import { SyncIdentityUseCase } from './use-cases/sync-identity.use-case';
import { GetMyProfileUseCase } from './use-cases/get-my-profile.use-case';
import { UpdateMyProfileUseCase } from './use-cases/update-my-profile.use-case';
import { GetMySummaryUseCase } from './use-cases/get-my-summary.use-case';

@Module({
  imports: [IdentityAuthRepositoriesModule, ClinicalDomainRepositoriesModule],
  controllers: [MeController],
  providers: [
    CurrentUserResolver,
    SyncIdentityUseCase,
    GetMyProfileUseCase,
    UpdateMyProfileUseCase,
    GetMySummaryUseCase,
  ],
  exports: [CurrentUserResolver],
})
export class IdentityModule {}
