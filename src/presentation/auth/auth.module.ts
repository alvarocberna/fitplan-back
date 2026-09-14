import { Module } from '@nestjs/common';
import { IdentityAuthRepositoriesModule } from '../../infrastructure/repositories/identity-auth/identity-auth-repositories.module';
import { CognitoAuthGuard } from './cognito-auth.guard';
import { AuthIdentityService } from './auth-identity.service';
import { AuthController } from './auth.controller';

@Module({
  imports: [IdentityAuthRepositoriesModule],
  controllers: [AuthController],
  providers: [CognitoAuthGuard, AuthIdentityService],
  exports: [CognitoAuthGuard, AuthIdentityService],
})
export class AuthModule {}
