import { Module } from '@nestjs/common';
import { WebhooksController } from './webhooks.controller';
import { WebhooksService } from './webhooks.service';
import { OrdenesModule } from '../ordenes/ordenes.module';
import { GeneracionPlanModule } from '../generacion-plan/generacion-plan.module';

@Module({
  imports: [OrdenesModule, GeneracionPlanModule],
  controllers: [WebhooksController],
  providers: [WebhooksService],
})
export class WebhooksModule {}
