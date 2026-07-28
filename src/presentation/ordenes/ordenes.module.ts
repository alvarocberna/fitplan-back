import { Module } from '@nestjs/common';
import { OrdenesController } from './ordenes.controller';
import { OrdenesService } from './ordenes.service';
import { RetencionService } from './retencion.service';

@Module({
  controllers: [OrdenesController],
  providers: [OrdenesService, RetencionService],
  exports: [OrdenesService],
})
export class OrdenesModule {}
