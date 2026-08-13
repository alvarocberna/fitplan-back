import { Injectable, InternalServerErrorException } from '@nestjs/common';
import OpenAI from 'openai';

@Injectable()
export class OpenaiService {
  private client: OpenAI;

  constructor() {
    this.client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  async chatJson<T>(
    systemPrompt: string,
    messages: Array<{ role: 'user' | 'assistant'; content: string }>,
    model = process.env.OPENAI_MODEL ?? 'gpt-4o-mini',
    // undefined = usa el default de la API (1). Bajarla (ej 0-0.3) reduce la aleatoriedad del
    // modelo: conviene para tareas de generación estructurada/con reglas estrictas (ver
    // generacion-plan.service.ts), no para el chat conversacional de consulta.service.ts.
    temperature?: number,
  ): Promise<T> {
    const response = await this.client.chat.completions.create({
      model,
      ...(temperature !== undefined ? { temperature } : {}),
      response_format: { type: 'json_object' },
      messages: [{ role: 'system', content: systemPrompt }, ...messages],
    });

    const content = response.choices[0]?.message?.content;
    if (!content) throw new InternalServerErrorException('OpenAI returned an empty response');

    return JSON.parse(content) as T;
  }
}