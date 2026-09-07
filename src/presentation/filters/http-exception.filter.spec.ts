import { ArgumentsHost, BadRequestException, NotFoundException } from '@nestjs/common';
import { HttpExceptionFilter } from './http-exception.filter';

function createMockHost(url = '/ordenes/crear'): { host: ArgumentsHost; response: any } {
  const response = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  const request = { url };
  const host = {
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => request,
    }),
  } as unknown as ArgumentsHost;
  return { host, response };
}

describe('HttpExceptionFilter', () => {
  let filter: HttpExceptionFilter;
  const originalEnv = process.env.NODE_ENV;

  beforeEach(() => {
    filter = new HttpExceptionFilter();
    jest.spyOn((filter as any).logger, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  it('usa el status code y message de la excepción cuando la respuesta es un string', () => {
    process.env.NODE_ENV = 'development';
    const { host, response } = createMockHost();
    filter.catch(new NotFoundException('Orden no encontrada'), host);

    expect(response.status).toHaveBeenCalledWith(404);
    const payload = response.json.mock.calls[0][0];
    expect(payload.statusCode).toBe(404);
    expect(payload.message).toBe('Orden no encontrada');
    expect(payload.path).toBe('/ordenes/crear');
  });

  it('extrae "message" cuando la respuesta de la excepción es un objeto', () => {
    const { host, response } = createMockHost();
    filter.catch(new BadRequestException({ message: ['campo x es requerido'] }), host);

    const payload = response.json.mock.calls[0][0];
    expect(payload.statusCode).toBe(400);
    expect(payload.message).toEqual(['campo x es requerido']);
  });

  it('en producción no incluye el detalle "exception" en el payload', () => {
    process.env.NODE_ENV = 'production';
    const { host, response } = createMockHost();
    filter.catch(new NotFoundException(), host);

    const payload = response.json.mock.calls[0][0];
    expect(payload.exception).toBeUndefined();
  });

  it('fuera de producción sí incluye el detalle "exception"', () => {
    process.env.NODE_ENV = 'development';
    const { host, response } = createMockHost();
    filter.catch(new NotFoundException(), host);

    const payload = response.json.mock.calls[0][0];
    expect(payload.exception).toBeDefined();
    expect(payload.exception.name).toBe('NotFoundException');
  });
});
