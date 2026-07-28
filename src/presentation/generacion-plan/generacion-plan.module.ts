import { Module } from '@nestjs/common';
import { GeneracionPlanService } from './generacion-plan.service';
import { OrdenesModule } from '../ordenes/ordenes.module';
import { OpenaiModule } from '../openai/openai.module';
import { NotificacionesModule } from '../notificaciones/notificaciones.module';

@Module({
  imports: [OrdenesModule, OpenaiModule, NotificacionesModule],
  providers: [GeneracionPlanService],
  exports: [GeneracionPlanService],
})
export class GeneracionPlanModule {}
