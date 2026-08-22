import { Module } from '@nestjs/common';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { RetentionService } from './retention.service';

@Module({
  controllers: [OrdersController],
  providers: [OrdersService, RetentionService],
  exports: [OrdersService],
})
export class OrdersModule {}
