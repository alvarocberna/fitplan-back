import { Module } from '@nestjs/common';
import { PlanGenerationService } from './plan-generation.service';
import { OrdersModule } from '../orders/orders.module';
import { OpenaiModule } from '../openai/openai.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PdfModule } from '../pdf/pdf.module';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [
    OrdersModule,
    OpenaiModule,
    NotificationsModule,
    PdfModule,
    StorageModule,
  ],
  providers: [PlanGenerationService],
  exports: [PlanGenerationService],
})
export class PlanGenerationModule {}
