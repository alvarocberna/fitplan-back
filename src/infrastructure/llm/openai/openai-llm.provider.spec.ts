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
