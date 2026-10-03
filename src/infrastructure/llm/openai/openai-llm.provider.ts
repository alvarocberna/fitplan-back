import { Injectable } from '@nestjs/common';
import OpenAI from 'openai';
import { LlmMessage, LlmProvider } from '../../../domain/ports';
import {
  LlmInvalidResponseError,
  LlmUnavailableError,
} from '../../../domain/errors/llm.errors';

// Tope por llamada al modelo. Explícito para no depender del default del SDK (10 minutos), que
// dejaría una request HTTP colgada mucho más de lo que espera el frontend.
const DEFAULT_TIMEOUT_MS = 60_000;
// Reintentos del propio SDK ante errores transitorios (red, 429, 5xx), con su backoff.
const MAX_RETRIES = 2;

@Injectable()
export class OpenaiLlmProvider implements LlmProvider {
  private client: OpenAI;

  constructor() {
    this.client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      timeout: Number(process.env.OPENAI_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS,
      maxRetries: MAX_RETRIES,
    });
  }

  async chatJson<T>(
    systemPrompt: string,
    messages: LlmMessage[],
    model = process.env.OPENAI_MODEL ?? 'gpt-4o-mini',
    // undefined = usa el default de la API (1). Bajarla (ej 0-0.3) reduce la aleatoriedad del
    // modelo: conviene para tareas de generación estructurada/con reglas estrictas (ver
    // GeneratePersonalizedPlanUseCase), no para el chat de anamnesis (ChatAnamnesisUseCase).
    temperature?: number,
  ): Promise<T> {
    let content: string | null | undefined;
    try {
      const response = await this.client.chat.completions.create({
        model,
        ...(temperature !== undefined ? { temperature } : {}),
        response_format: { type: 'json_object' },
        messages: [{ role: 'system', content: systemPrompt }, ...messages],
      });
      content = response.choices[0]?.message?.content;
    } catch (error) {
      // Cualquier error del SDK (red, timeout, rate limit, 4xx/5xx del proveedor) se traduce al error
      // del puerto: quien llama no conoce a OpenAI.
      const cause = error as { status?: number; message?: string };
      throw new LlmUnavailableError(
        `OpenAI no respondió${cause?.status ? ` (HTTP ${cause.status})` : ''}: ${cause?.message ?? 'error desconocido'}`,
        error,
      );
    }

    if (!content) throw new LlmInvalidResponseError('OpenAI devolvió una respuesta vacía');

    try {
      return JSON.parse(content) as T;
    } catch {
      throw new LlmInvalidResponseError('OpenAI devolvió una respuesta que no es JSON válido');
    }
  }
}
