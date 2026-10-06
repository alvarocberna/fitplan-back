import {
  LlmInvalidResponseError,
  LlmUnavailableError,
} from '../../../domain/errors/llm.errors';
import { OpenaiLlmProvider } from './openai-llm.provider';

const createMock = jest.fn();

jest.mock('openai', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      chat: { completions: { create: createMock } },
    })),
  };
});

describe('OpenaiLlmProvider', () => {
  let service: OpenaiLlmProvider;

  beforeEach(() => {
    createMock.mockReset();
    service = new OpenaiLlmProvider();
  });

  it('devuelve el contenido de la respuesta parseado como JSON', async () => {
    createMock.mockResolvedValue({
      choices: [{ message: { content: '{"reply":"hola"}' } }],
    });

    const result = await service.chatJson<{ reply: string }>('system', [
      { role: 'user', content: 'hola' },
    ]);

    expect(result).toEqual({ reply: 'hola' });
  });

  it('lanza LlmInvalidResponseError si la respuesta viene vacía', async () => {
    createMock.mockResolvedValue({ choices: [{ message: { content: '' } }] });

    await expect(
      service.chatJson('system', [{ role: 'user', content: 'hola' }]),
    ).rejects.toBeInstanceOf(LlmInvalidResponseError);
  });

  it('lanza LlmInvalidResponseError si no hay choices', async () => {
    createMock.mockResolvedValue({ choices: [] });

    await expect(
      service.chatJson('system', [{ role: 'user', content: 'hola' }]),
    ).rejects.toBeInstanceOf(LlmInvalidResponseError);
  });

  it('pasa model/temperature al SDK, y agrega response_format json_object + el system prompt', async () => {
    createMock.mockResolvedValue({ choices: [{ message: { content: '{}' } }] });

    await service.chatJson('mi system prompt', [{ role: 'user', content: 'hola' }], 'gpt-4o-mini', 0.2);

    expect(createMock).toHaveBeenCalledWith({
      model: 'gpt-4o-mini',
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: 'mi system prompt' },
        { role: 'user', content: 'hola' },
      ],
    });
  });

  it('no envía "temperature" si no se especifica (gpt-5-mini solo acepta el default)', async () => {
    createMock.mockResolvedValue({ choices: [{ message: { content: '{}' } }] });

    await service.chatJson('system', [{ role: 'user', content: 'hola' }], 'gpt-5-mini');

    const callArgs = createMock.mock.calls[0][0];
    expect(callArgs).not.toHaveProperty('temperature');
  });

  it('traduce un error del SDK (red, rate limit, 5xx) a LlmUnavailableError, con el status en el mensaje', async () => {
    createMock.mockRejectedValue(Object.assign(new Error('Rate limit reached'), { status: 429 }));

    const error = (await service
      .chatJson('system', [{ role: 'user', content: 'hola' }])
      .catch((e: unknown) => e)) as Error;

    expect(error).toBeInstanceOf(LlmUnavailableError);
    expect(error.message).toContain('HTTP 429');
    expect(error.message).toContain('Rate limit reached');
  });

  it('lanza LlmInvalidResponseError si la respuesta no es JSON válido', async () => {
    createMock.mockResolvedValue({ choices: [{ message: { content: 'no soy json' } }] });

    await expect(
      service.chatJson('system', [{ role: 'user', content: 'hola' }]),
    ).rejects.toBeInstanceOf(LlmInvalidResponseError);
  });

  it('sin opciones no pasa límites por llamada: rigen el timeout y los reintentos por defecto del cliente', async () => {
    createMock.mockResolvedValue({ choices: [{ message: { content: '{}' } }] });

    await service.chatJson('system', [{ role: 'user', content: 'hola' }]);

    expect(createMock.mock.calls[0]).toHaveLength(1);
  });

  it('pasa al SDK el timeout y los reintentos propios de la llamada (la generación del plan tarda minutos)', async () => {
    createMock.mockResolvedValue({ choices: [{ message: { content: '{}' } }] });

    await service.chatJson('system', [{ role: 'user', content: 'hola' }], 'gpt-5-mini', undefined, {
      timeoutMs: 300_000,
      maxRetries: 0,
    });

    expect(createMock.mock.calls[0][1]).toEqual({ timeout: 300_000, maxRetries: 0 });
  });

  describe('structured output (options.schema)', () => {
    const schema = {
      name: 'goal_classification',
      schema: {
        type: 'object' as const,
        properties: { goal: { type: 'string' as const, enum: ['definicion', 'volumen'] } },
        required: ['goal'],
        additionalProperties: false as const,
      },
    };
    const call = () =>
      service.chatJson('system', [{ role: 'user', content: 'hola' }], 'gpt-5-mini', undefined, { schema });

    it('con esquema pide json_schema en modo estricto, y no lo pasa como opción del SDK', async () => {
      createMock.mockResolvedValue({ choices: [{ message: { content: '{"goal":"volumen"}' } }] });

      await expect(call()).resolves.toEqual({ goal: 'volumen' });

      expect(createMock.mock.calls[0][0].response_format).toEqual({
        type: 'json_schema',
        json_schema: { name: 'goal_classification', strict: true, schema: schema.schema },
      });
      expect(createMock.mock.calls[0]).toHaveLength(1);
    });

    it('si la respuesta no cumple el esquema lanza LlmInvalidResponseError con el detalle', async () => {
      createMock.mockResolvedValue({ choices: [{ message: { content: '{"goal":"otra cosa"}' } }] });

      const error = (await call().catch((e: unknown) => e)) as Error;

      expect(error).toBeInstanceOf(LlmInvalidResponseError);
      expect(error.message).toContain('no cumple el esquema "goal_classification" (1 error(es))');
      expect(error.message).toContain('$.goal');
    });

    it('detalla como máximo 5 errores de esquema, pero informa el total', async () => {
      const wide = {
        name: 'wide',
        schema: {
          type: 'object' as const,
          properties: Object.fromEntries(
            ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((key) => [key, { type: 'string' as const }]),
          ),
          required: ['a', 'b', 'c', 'd', 'e', 'f', 'g'],
          additionalProperties: false as const,
        },
      };
      createMock.mockResolvedValue({ choices: [{ message: { content: '{}' } }] });

      const error = (await service
        .chatJson('system', [{ role: 'user', content: 'hola' }], undefined, undefined, { schema: wide })
        .catch((e: unknown) => e)) as Error;

      expect(error.message).toContain('(7 error(es))');
      expect(error.message).toContain('$.e');
      expect(error.message).not.toContain('$.f');
    });

    it('sin esquema no valida la estructura (chat de anamnesis)', async () => {
      createMock.mockResolvedValue({ choices: [{ message: { content: '{"cualquier":"cosa"}' } }] });

      await expect(
        service.chatJson('system', [{ role: 'user', content: 'hola' }]),
      ).resolves.toEqual({ cualquier: 'cosa' });
    });
  });

  it('si el modelo se niega a responder (refusal) lanza LlmInvalidResponseError', async () => {
    createMock.mockResolvedValue({
      choices: [{ message: { content: null, refusal: 'No puedo ayudar con eso' } }],
    });

    const error = (await service
      .chatJson('system', [{ role: 'user', content: 'hola' }])
      .catch((e: unknown) => e)) as Error;

    expect(error).toBeInstanceOf(LlmInvalidResponseError);
    expect(error.message).toContain('se negó a responder: No puedo ayudar con eso');
  });

  it('si la respuesta se cortó por límite de tokens lanza LlmInvalidResponseError (no intenta usar el JSON incompleto)', async () => {
    createMock.mockResolvedValue({
      choices: [{ finish_reason: 'length', message: { content: '{"reply":"hol' } }],
    });

    const error = (await service
      .chatJson('system', [{ role: 'user', content: 'hola' }])
      .catch((e: unknown) => e)) as Error;

    expect(error).toBeInstanceOf(LlmInvalidResponseError);
    expect(error.message).toContain('límite de tokens');
  });

  it('una respuesta cortada igual informa sus métricas (los tokens se consumieron)', async () => {
    createMock.mockResolvedValue({
      choices: [{ finish_reason: 'length', message: { content: '{' } }],
      usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
    });
    const onMetrics = jest.fn();

    await service
      .chatJson('system', [{ role: 'user', content: 'hola' }], undefined, undefined, { onMetrics })
      .catch(() => undefined);

    expect(onMetrics).toHaveBeenCalledWith(expect.objectContaining({ completionTokens: 20 }));
  });

  describe('métricas de la llamada (onMetrics)', () => {
    it('informa modelo, duración y tokens de entrada, salida y razonamiento', async () => {
      createMock.mockResolvedValue({
        choices: [{ message: { content: '{}' } }],
        usage: {
          prompt_tokens: 9000,
          completion_tokens: 6000,
          total_tokens: 15000,
          completion_tokens_details: { reasoning_tokens: 4000 },
        },
      });
      const onMetrics = jest.fn();

      await service.chatJson('system', [{ role: 'user', content: 'hola' }], 'gpt-5-mini', undefined, {
        onMetrics,
      });

      expect(onMetrics).toHaveBeenCalledWith({
        model: 'gpt-5-mini',
        durationMs: expect.any(Number),
        promptTokens: 9000,
        completionTokens: 6000,
        reasoningTokens: 4000,
        totalTokens: 15000,
      });
      // onMetrics no es una opción del SDK: no se le pasa
      expect(createMock.mock.calls[0]).toHaveLength(1);
    });

    it('si el proveedor no informa el consumo, los tokens van en null', async () => {
      createMock.mockResolvedValue({ choices: [{ message: { content: '{}' } }] });
      const onMetrics = jest.fn();

      await service.chatJson('system', [{ role: 'user', content: 'hola' }], undefined, undefined, { onMetrics });

      expect(onMetrics).toHaveBeenCalledWith(
        expect.objectContaining({ promptTokens: null, completionTokens: null, reasoningTokens: null }),
      );
    });

    it('un error dentro de onMetrics no rompe la llamada', async () => {
      createMock.mockResolvedValue({ choices: [{ message: { content: '{"ok":true}' } }] });

      await expect(
        service.chatJson('system', [{ role: 'user', content: 'hola' }], undefined, undefined, {
          onMetrics: () => {
            throw new Error('bug en la instrumentación');
          },
        }),
      ).resolves.toEqual({ ok: true });
    });

    it('no informa métricas si la llamada falla', async () => {
      createMock.mockRejectedValue(new Error('timeout'));
      const onMetrics = jest.fn();

      await service
        .chatJson('system', [{ role: 'user', content: 'hola' }], undefined, undefined, { onMetrics })
        .catch(() => undefined);

      expect(onMetrics).not.toHaveBeenCalled();
    });
  });
});
