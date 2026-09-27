import { Module } from '@nestjs/common';
import { LlmProvider } from '../../../domain/ports';
import { OpenaiLlmProvider } from './openai-llm.provider';

@Module({
  providers: [{ provide: LlmProvider, useClass: OpenaiLlmProvider }],
  exports: [LlmProvider],
})
export class LlmModule {}
