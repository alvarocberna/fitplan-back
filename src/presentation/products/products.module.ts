import { Module } from '@nestjs/common';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { CommercialDomainRepositoriesModule } from '../../infrastructure/repositories/commercial-domain/commercial-domain-repositories.module';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [CommercialDomainRepositoriesModule, StorageModule],
  controllers: [ProductsController],
  providers: [ProductsService],
})
export class ProductsModule {}
