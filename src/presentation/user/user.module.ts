import { Module } from '@nestjs/common';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { AuthModule } from '../auth/auth.module';
import { IdentityAuthRepositoriesModule } from '../../infrastructure/repositories/identity-auth/identity-auth-repositories.module';

@Module({
  imports: [AuthModule, IdentityAuthRepositoriesModule],
  controllers: [UserController],
  providers: [UserService],
})
export class UserModule {}
