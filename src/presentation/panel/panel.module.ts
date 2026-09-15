import { Module } from '@nestjs/common';
import { PanelController } from './panel.controller';
import { PanelService } from './panel.service';
import { AuthModule } from '../auth/auth.module';
import { ClinicalDomainRepositoriesModule } from '../../infrastructure/repositories/clinical-domain/clinical-domain-repositories.module';

@Module({
  imports: [AuthModule, ClinicalDomainRepositoriesModule],
  controllers: [PanelController],
  providers: [PanelService],
})
export class PanelModule {}
