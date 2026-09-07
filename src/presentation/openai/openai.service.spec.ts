import { InternalServerErrorException } from '@nestjs/common';
import { OpenaiService } from './openai.service';

const createMock = jest.fn();

jest.mock('openai', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      chat: { completions: { create: createMock } },
    })),
  };
});

describe('OpenaiService', () => {
  let service: OpenaiService;

  beforeEach(() => {
    createMock.mockReset();
    service = new OpenaiService();
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

  it('lanza InternalServerErrorException si la respuesta viene vacía', async () => {
    createMock.mockResolvedValue({ choices: [{ message: { content: '' } }] });

    await expect(
      service.chatJson('system', [{ role: 'user', content: 'hola' }]),
    ).rejects.toBeInstanceOf(InternalServerErrorException);
  });

  it('lanza InternalServerErrorException si no hay choices', async () => {
    createMock.mockResolvedValue({ choices: [] });

    await expect(
      service.chatJson('system', [{ role: 'user', content: 'hola' }]),
    ).rejects.toBeInstanceOf(InternalServerErrorException);
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
});
