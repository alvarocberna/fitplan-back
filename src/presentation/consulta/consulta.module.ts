import { Module } from '@nestjs/common';
import { OpenaiModule } from '../openai/openai.module';
import { ConsultaService } from './consulta.service';
import { ConsultaController } from './consulta.controller';

@Module({
  imports: [OpenaiModule],
  controllers: [ConsultaController],
  providers: [ConsultaService],
})
export class ConsultaModule {}
