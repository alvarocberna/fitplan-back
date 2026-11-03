import {
  ArgumentsHost,
  BadRequestException,
  ConflictException,
  HttpException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma } from '../../../generated/prisma';
import {
  LlmInvalidResponseError,
  LlmUnavailableError,
} from '../../domain/errors/llm.errors';
import { IdentityProviderUnavailableError } from '../../domain/errors/identity.errors';
import { PaymentGatewayUnavailableError } from '../../domain/errors/payment.errors';
import { ErrorCode } from '../errors/error-codes';
import { AllExceptionsFilter } from './all-exceptions.filter';

function createMockHost(request: Record<string, unknown> = {}): {
  host: ArgumentsHost;
  response: any;
} {
  const response = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  const host = {
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => ({
        url: '/api/v1/consultations',
        method: 'POST',
        requestId: 'req-12345678',
        ...request,
      }),
    }),
  } as unknown as ArgumentsHost;
  return { host, response };
}

function prismaKnownError(code: string): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('detalle interno de prisma', {
    code,
    clientVersion: 'test',
  });
}

describe('AllExceptionsFilter', () => {
  let filter: AllExceptionsFilter;
  let logger: {
    error: jest.SpyInstance;
    warn: jest.SpyInstance;
    debug: jest.SpyInstance;
  };

  const run = (exception: unknown, request?: Record<string, unknown>) => {
    const { host, response } = createMockHost(request);
    filter.catch(exception, host);
    return {
      status: response.status.mock.calls[0][0],
      body: response.json.mock.calls[0][0],
    };
  };

  beforeEach(() => {
    filter = new AllExceptionsFilter();
    const target = (filter as any).logger;
    logger = {
      error: jest.spyOn(target, 'error').mockImplementation(() => undefined),
      warn: jest.spyOn(target, 'warn').mockImplementation(() => undefined),
      debug: jest.spyOn(target, 'debug').mockImplementation(() => undefined),
    };
  });

  describe('formato de la respuesta', () => {
    it('responde siempre { statusCode, code, message, requestId, timestamp, path }', () => {
      const { status, body } = run(
        new NotFoundException('Orden no encontrada'),
      );

      expect(status).toBe(404);
      expect(body).toEqual({
        statusCode: 404,
        code: ErrorCode.NOT_FOUND,
        message: 'Orden no encontrada',
        requestId: 'req-12345678',
        timestamp: expect.any(String),
        path: '/api/v1/consultations',
      });
    });

    it('nunca incluye el detalle de la excepción (ni fuera de producción)', () => {
      const original = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      const { body } = run(new Error('SELECT * FROM secret'));
      process.env.NODE_ENV = original;

      expect(body.exception).toBeUndefined();
      expect(JSON.stringify(body)).not.toContain('secret');
    });
  });

  describe('HttpException', () => {
    it('usa el code y el message que trae la excepción', () => {
      const { status, body } = run(
        new ConflictException({
          code: ErrorCode.ORDER_EXPIRED,
          message: 'La orden expiró sin pagarse',
        }),
      );

      expect(status).toBe(409);
      expect(body.code).toBe(ErrorCode.ORDER_EXPIRED);
      expect(body.message).toBe('La orden expiró sin pagarse');
    });

    it('sin code propio lo deriva del status', () => {
      expect(
        run(new UnauthorizedException('Token inválido o expirado')).body.code,
      ).toBe(ErrorCode.UNAUTHENTICATED);
      expect(
        run(new BadRequestException('Se requieren peso y talla')).body.code,
      ).toBe(ErrorCode.BAD_REQUEST);
    });

    it('un message en arreglo pasa a errors y message queda como string', () => {
      const { body } = run(
        new BadRequestException({ message: ['campo x es requerido'] }),
      );

      expect(body.message).toBe('La solicitud no es válida');
      expect(body.errors).toEqual(['campo x es requerido']);
    });

    it('respeta el formato del ValidationPipe: code VALIDATION_ERROR, message y errors', () => {
      const { body } = run(
        new BadRequestException({
          code: ErrorCode.VALIDATION_ERROR,
          message: 'Los datos enviados no son válidos',
          errors: ['weight must be a number'],
        }),
      );

      expect(body.code).toBe(ErrorCode.VALIDATION_ERROR);
      expect(body.message).toBe('Los datos enviados no son válidos');
      expect(body.errors).toEqual(['weight must be a number']);
    });

    it.each([
      [new NotFoundException(), 'No encontramos lo que buscas'],
      [
        new NotFoundException('Cannot GET /api/v1/nada'),
        'No encontramos lo que buscas',
      ],
      [
        new BadRequestException('Validation failed (uuid v 4 is expected)'),
        'La solicitud no es válida',
      ],
    ])(
      'reemplaza los textos en inglés del framework por un mensaje en español',
      (exception, message) => {
        expect(run(exception).body.message).toBe(message);
      },
    );
  });

  describe('errores de Prisma', () => {
    it.each([
      ['P2002', 409, ErrorCode.CONFLICT],
      ['P2003', 409, ErrorCode.CONFLICT],
      ['P2025', 404, ErrorCode.NOT_FOUND],
      ['P1001', 503, ErrorCode.DATABASE_UNAVAILABLE],
      ['P2024', 503, ErrorCode.DATABASE_UNAVAILABLE],
      ['P2010', 500, ErrorCode.INTERNAL_ERROR],
    ])(
      '%s -> %i %s, sin filtrar el mensaje interno',
      (prismaCode, statusCode, code) => {
        const { status, body } = run(prismaKnownError(prismaCode));

        expect(status).toBe(statusCode);
        expect(body.code).toBe(code);
        expect(body.message).not.toContain('prisma');
      },
    );

    it('no poder conectarse a la base responde 503 DATABASE_UNAVAILABLE', () => {
      const { status, body } = run(
        new Prisma.PrismaClientInitializationError(
          "Can't reach database server",
          'test',
        ),
      );

      expect(status).toBe(503);
      expect(body.code).toBe(ErrorCode.DATABASE_UNAVAILABLE);
    });
  });

  describe('otros errores', () => {
    it.each([
      [new LlmUnavailableError('OpenAI no respondió (HTTP 429)')],
      [new LlmInvalidResponseError('respuesta vacía')],
    ])(
      'un error del proveedor de LLM responde 503 LLM_UNAVAILABLE',
      (exception) => {
        const { status, body } = run(exception);

        expect(status).toBe(503);
        expect(body.code).toBe(ErrorCode.LLM_UNAVAILABLE);
        expect(body.message).not.toContain('OpenAI');
      },
    );

    it('un fallo de la pasarela de pago responde 503 PAYMENT_UNAVAILABLE, sin detalle del proveedor', () => {
      const { status, body } = run(
        new PaymentGatewayUnavailableError('Transbank commit: 422'),
      );

      expect(status).toBe(503);
      expect(body.code).toBe(ErrorCode.PAYMENT_UNAVAILABLE);
      expect(body.message).not.toContain('Transbank');
    });

    it('un fallo del proveedor de identidad responde 503 AUTH_UNAVAILABLE', () => {
      const { status, body } = run(
        new IdentityProviderUnavailableError('Cognito respondió HTTP 500'),
      );

      expect(status).toBe(503);
      expect(body.code).toBe(ErrorCode.AUTH_UNAVAILABLE);
      expect(body.message).not.toContain('Cognito');
    });

    it('el rate limiting responde 429 RATE_LIMITED con un mensaje en español', () => {
      const { status, body } = run(
        new HttpException('ThrottlerException: Too Many Requests', 429),
      );

      expect(status).toBe(429);
      expect(body.code).toBe(ErrorCode.RATE_LIMITED);
      expect(body.message).toContain('demasiadas solicitudes');
    });

    it('un error 4xx de un middleware de Express (body demasiado grande) conserva su status', () => {
      const { status, body } = run(
        Object.assign(new Error('request entity too large'), { status: 413 }),
      );

      expect(status).toBe(413);
      expect(body.code).toBe(ErrorCode.PAYLOAD_TOO_LARGE);
      expect(logger.error).not.toHaveBeenCalled();
    });

    it('un status 5xx en un error que no es HttpException no se respeta: es un 500', () => {
      expect(run(Object.assign(new Error('x'), { status: 502 })).status).toBe(
        500,
      );
    });

    it('un error desconocido responde 500 INTERNAL_ERROR con un mensaje genérico', () => {
      const { status, body } = run(new Error('algo explotó en la línea 42'));

      expect(status).toBe(500);
      expect(body.code).toBe(ErrorCode.INTERNAL_ERROR);
      expect(body.message).toBe(
        'Ocurrió un error inesperado. Intenta nuevamente.',
      );
    });

    it('algo lanzado que no es un Error también responde 500', () => {
      expect(run('boom').status).toBe(500);
    });

    it('sin requestId en la request no lo incluye', () => {
      expect(
        run(new Error('x'), { requestId: undefined }).body,
      ).not.toHaveProperty('requestId');
    });
  });

  describe('nivel de log', () => {
    it('un 5xx se loguea como error, con el stack y el requestId', () => {
      const exception = new Error('algo explotó');
      run(exception);

      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          requestId: 'req-12345678',
          status: 500,
          cause: 'Error: algo explotó',
        }),
        exception.stack,
      );
    });

    it('un error de Prisma se loguea como error aunque se responda 4xx, con su código', () => {
      run(prismaKnownError('P2002'));

      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({ status: 409, prismaCode: 'P2002' }),
        expect.any(String),
      );
    });

    it('401 y 404 se loguean como debug (tráfico normal)', () => {
      run(new UnauthorizedException('Token inválido o expirado'));
      run(new NotFoundException('Consulta no encontrada'));

      expect(logger.debug).toHaveBeenCalledTimes(2);
      expect(logger.error).not.toHaveBeenCalled();
      expect(logger.warn).not.toHaveBeenCalled();
    });

    it('el resto de los 4xx se loguea como warn, sin stack', () => {
      run(new BadRequestException('Se requieren peso y talla'));

      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ status: 400 }),
      );
      expect(logger.error).not.toHaveBeenCalled();
    });
  });
});
