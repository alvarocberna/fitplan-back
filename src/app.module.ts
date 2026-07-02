import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AnamnesisModule } from './presentation/anamnesis/anamnesis.module';
import { ConsultaModule } from './presentation/consulta/consulta.module';
import { OpenaiModule } from './presentation/openai/openai.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    AnamnesisModule,
    ConsultaModule,
    OpenaiModule,
  ],
})
export class AppModule {}
