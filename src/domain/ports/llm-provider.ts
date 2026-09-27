export interface LlmMessage {
  role: 'user' | 'assistant';
  content: string;
}

// Puerto hacia el modelo de lenguaje (hoy OpenAI, ver infrastructure/llm/openai). Los casos de uso
// dependen de esta clase abstracta —Nest la usa como token de inyección—, así pueden mockearla en
// los tests sin conocer el SDK del proveedor.
export abstract class LlmProvider {
  // Pide una respuesta en formato JSON y la devuelve ya parseada. `model` y `temperature` son
  // opcionales: undefined = el default del proveedor.
  abstract chatJson<T>(
    systemPrompt: string,
    messages: LlmMessage[],
    model?: string,
    temperature?: number,
  ): Promise<T>;
}
