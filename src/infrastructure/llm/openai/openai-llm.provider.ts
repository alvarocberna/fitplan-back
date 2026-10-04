import { Injectable } from '@nestjs/common';
import OpenAI from 'openai';
import { LlmCallOptions, LlmMessage, LlmProvider } from '../../../domain/ports';
import {
  LlmInvalidResponseError,
  LlmUnavailableError,
} from '../../../domain/errors/llm.errors';

// Tope POR DEFECTO de una llamada al modelo: el de las llamadas que ocurren dentro de una request
// HTTP (chat de anamnesis, clasificación del objetivo), que responden en segundos. Explícito para no
// depender del default del SDK (10 minutos), que dejaría la request colgada mucho más de lo que
// espera el frontend. NO sirve para la generación del plan, que tarda minutos: esa llamada pasa su
// propio `timeoutMs` (ver LlmCallOptions y GeneratePersonalizedPlanUseCase).
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
    options?: LlmCallOptions,
  ): Promise<T> {
    // Límites propios de esta llamada; lo que no venga usa el default del cliente.
    const requestOptions = {
      ...(options?.timeoutMs !== undefined && { timeout: options.timeoutMs }),
      ...(options?.maxRetries !== undefined && { maxRetries: options.maxRetries }),
    };
    let content: string | null | undefined;
    const startedAt = performance.now();
    try {
      const response = await this.client.chat.completions.create(
        {
          model,
          ...(temperature !== undefined ? { temperature } : {}),
          response_format: { type: 'json_object' },
          messages: [{ role: 'system', content: systemPrompt }, ...messages],
        },
        ...(Object.keys(requestOptions).length > 0 ? [requestOptions] : []),
      );
      content = response.choices[0]?.message?.content;
      this.reportMetrics(options, model, performance.now() - startedAt, response.usage);
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

  // Entrega a quien llamó la duración y el consumo de tokens. Una métrica nunca debe romper la
  // llamada: cualquier error del callback se ignora.
  private reportMetrics(
    options: LlmCallOptions | undefined,
    model: string,
    durationMs: number,
    usage: OpenAI.CompletionUsage | undefined,
  ): void {
    if (!options?.onMetrics) return;
    try {
      options.onMetrics({
        model,
        durationMs: Math.round(durationMs),
        promptTokens: usage?.prompt_tokens ?? null,
        completionTokens: usage?.completion_tokens ?? null,
        reasoningTokens: usage?.completion_tokens_details?.reasoning_tokens ?? null,
        totalTokens: usage?.total_tokens ?? null,
      });
    } catch {
      // instrumentación: no afecta el resultado
    }
  }
}
