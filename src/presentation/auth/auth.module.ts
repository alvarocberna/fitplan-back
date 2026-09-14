import { Module } from '@nestjs/common';
import { IdentityAuthRepositoriesModule } from '../../infrastructure/repositories/identity-auth/identity-auth-repositories.module';
import { CognitoAuthGuard } from './cognito-auth.guard';
import { AuthIdentityService } from './auth-identity.service';

@Module({
  imports: [IdentityAuthRepositoriesModule],
  providers: [CognitoAuthGuard, AuthIdentityService],
  exports: [CognitoAuthGuard, AuthIdentityService],
})
export class AuthModule {}
