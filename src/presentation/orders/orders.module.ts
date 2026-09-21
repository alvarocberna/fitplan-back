import { Module } from '@nestjs/common';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { AuthModule } from '../auth/auth.module';
import { ClinicalDomainRepositoriesModule } from '../../infrastructure/repositories/clinical-domain/clinical-domain-repositories.module';
import { CommercialDomainRepositoriesModule } from '../../infrastructure/repositories/commercial-domain/commercial-domain-repositories.module';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [
    AuthModule,
    ClinicalDomainRepositoriesModule,
    CommercialDomainRepositoriesModule,
    StorageModule,
  ],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
