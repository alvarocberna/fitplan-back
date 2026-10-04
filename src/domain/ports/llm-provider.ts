export interface LlmMessage {
  role: 'user' | 'assistant';
  content: string;
}

// Puerto hacia el modelo de lenguaje (hoy OpenAI, ver infrastructure/llm/openai). Los casos de uso
// dependen de esta clase abstracta —Nest la usa como token de inyección—, así pueden mockearla en
// los tests sin conocer el SDK del proveedor.
// Límites de una llamada puntual al modelo. Sin ellos rigen los del adaptador, pensados para una
// llamada dentro de una request HTTP (respuesta en segundos). Una tarea larga en segundo plano (la
// generación del plan) declara los suyos.
export interface LlmCallOptions {
  // tiempo máximo de espera de la respuesta, en milisegundos
  timeoutMs?: number;
  // reintentos automáticos del adaptador ante un error transitorio (0 = ninguno: reintenta quien llama)
  maxRetries?: number;
  // Recibe las métricas de la llamada cuando el proveedor responde (no se invoca si la llamada falla).
  // Sirve para instrumentar: cuánto tardó y cuántos tokens consumió.
  onMetrics?: (metrics: LlmCallMetrics) => void;
}

// Métricas de una llamada al modelo. Los conteos de tokens son null si el proveedor no los informa.
export interface LlmCallMetrics {
  model: string;
  durationMs: number;
  // tokens de entrada (prompt)
  promptTokens: number | null;
  // tokens de salida, incluidos los de razonamiento
  completionTokens: number | null;
  // parte de los tokens de salida que el modelo gastó "pensando" (no aparecen en la respuesta)
  reasoningTokens: number | null;
  totalTokens: number | null;
}

export abstract class LlmProvider {
  // Pide una respuesta en formato JSON y la devuelve ya parseada. `model` y `temperature` son
  // opcionales: undefined = el default del proveedor.
  abstract chatJson<T>(
    systemPrompt: string,
    messages: LlmMessage[],
    model?: string,
    temperature?: number,
    options?: LlmCallOptions,
  ): Promise<T>;
}
