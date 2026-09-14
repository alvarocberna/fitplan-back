import { Module } from '@nestjs/common';
import { ConsultationService } from './consultation.service';
import { ConsultationController } from './consultation.controller';
import { OpenaiModule } from '../openai/openai.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [OpenaiModule, AuthModule],
  controllers: [ConsultationController],
  providers: [ConsultationService],
})
export class ConsultationModule {}
