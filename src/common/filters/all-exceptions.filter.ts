import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { Prisma } from '../../../generated/prisma';
import { IdentityProviderUnavailableError } from '../../domain/errors/identity.errors';
import {
  LlmInvalidResponseError,
  LlmUnavailableError,
} from '../../domain/errors/llm.errors';
import { PaymentGatewayUnavailableError } from '../../domain/errors/payment.errors';
import {
  defaultMessageFromStatus,
  ErrorCode,
  errorCodeFromStatus,
} from '../errors/error-codes';

// Contrato único de error de la API. `message` es siempre un string pensado para el usuario (en
// español); `errors` lleva el detalle técnico de una validación fallida.
export interface ErrorResponseBody {
  statusCode: number;
  code: ErrorCode | string;
  message: string;
  errors?: string[];
  requestId?: string;
  timestamp: string;
  path?: string;
}

type ResolvedError = Pick<ErrorResponseBody, 'statusCode' | 'code' | 'message' | 'errors'>;

// Códigos de Prisma que significan "no se pudo hablar con la base de datos".
const PRISMA_CONNECTION_CODES = new Set(['P1001', 'P1002', 'P1008', 'P1017', 'P2024']);

const LLM_UNAVAILABLE_MESSAGE =
  'El asistente no está disponible en este momento. Intenta nuevamente en unos minutos.';
const DATABASE_UNAVAILABLE_MESSAGE =
  'El servicio no está disponible en este momento. Intenta nuevamente en unos minutos.';

// Filtro global: atrapa TODA excepción que salga de una request (no solo HttpException) y responde
// siempre con el mismo formato. El detalle de un error no controlado nunca viaja al cliente: queda en
// el log, junto al requestId que sí se devuelve para poder correlacionarlo.
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<{ url?: string; method?: string; requestId?: string }>();

    const resolved = this.resolve(exception);
    const requestId = request?.requestId;

    this.log(exception, resolved, request);

    const payload: ErrorResponseBody = {
      statusCode: resolved.statusCode,
      code: resolved.code,
      message: resolved.message,
      ...(resolved.errors && { errors: resolved.errors }),
      ...(requestId && { requestId }),
      timestamp: new Date().toISOString(),
      path: request?.url,
    };

    return response.status(resolved.statusCode).json(payload);
  }

  private resolve(exception: unknown): ResolvedError {
    if (exception instanceof HttpException) return this.fromHttpException(exception);

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      return this.fromPrismaKnownError(exception);
    }
    if (
      exception instanceof Prisma.PrismaClientInitializationError ||
      exception instanceof Prisma.PrismaClientRustPanicError
    ) {
      return {
        statusCode: HttpStatus.SERVICE_UNAVAILABLE,
        code: ErrorCode.DATABASE_UNAVAILABLE,
        message: DATABASE_UNAVAILABLE_MESSAGE,
      };
    }

    if (
      exception instanceof LlmUnavailableError ||
      exception instanceof LlmInvalidResponseError
    ) {
      return {
        statusCode: HttpStatus.SERVICE_UNAVAILABLE,
        code: ErrorCode.LLM_UNAVAILABLE,
        message: LLM_UNAVAILABLE_MESSAGE,
      };
    }

    if (exception instanceof PaymentGatewayUnavailableError) {
      return {
        statusCode: HttpStatus.SERVICE_UNAVAILABLE,
        code: ErrorCode.PAYMENT_UNAVAILABLE,
        message:
          'No pudimos conectar con el medio de pago en este momento. Intenta nuevamente en unos minutos.',
      };
    }

    if (exception instanceof IdentityProviderUnavailableError) {
      return {
        statusCode: HttpStatus.SERVICE_UNAVAILABLE,
        code: ErrorCode.AUTH_UNAVAILABLE,
        message:
          'No pudimos verificar tu cuenta en este momento. Intenta nuevamente en unos minutos.',
      };
    }

    // Errores de middlewares de Express (body-parser: cuerpo demasiado grande, JSON malformado) no
    // son HttpException pero traen su status. Solo se respeta si es un error del cliente (4xx).
    const status = (exception as { status?: unknown; statusCode?: unknown })?.status ??
      (exception as { statusCode?: unknown })?.statusCode;
    if (typeof status === 'number' && status >= 400 && status < 500) {
      return {
        statusCode: status,
        code: errorCodeFromStatus(status),
        message: defaultMessageFromStatus(status),
      };
    }

    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      code: ErrorCode.INTERNAL_ERROR,
      message: defaultMessageFromStatus(HttpStatus.INTERNAL_SERVER_ERROR),
    };
  }

  // La respuesta de una HttpException puede ser un string, o un objeto { message, code?, errors? }
  // donde message es string o string[] (lo que arman las excepciones de Nest y los pipes).
  private fromHttpException(exception: HttpException): ResolvedError {
    const statusCode = exception.getStatus();
    const body = exception.getResponse();

    let message: string | undefined;
    let errors: string[] | undefined;
    let code: string | undefined;
    // Sin body propio, Nest usa el nombre del status en inglés ("Not Found"): no es un mensaje para
    // el usuario, se reemplaza por el por defecto.
    let isFrameworkDefault = false;

    if (typeof body === 'string') {
      message = body;
    } else if (body && typeof body === 'object') {
      const raw = body as { message?: unknown; errors?: unknown; code?: unknown; error?: unknown };
      if (typeof raw.code === 'string') code = raw.code;
      if (Array.isArray(raw.errors)) errors = raw.errors.map(String);
      if (Array.isArray(raw.message)) {
        errors = errors ?? raw.message.map(String);
      } else if (typeof raw.message === 'string') {
        message = raw.message;
        isFrameworkDefault = code === undefined && raw.message === raw.error;
      }
    }

    // Una ruta inexistente ("Cannot GET /x") o un pipe de Nest ("Validation failed (uuid…)") traen
    // textos en inglés: el detalle va a `errors` y el usuario ve el mensaje por defecto.
    if (message && !code && this.isFrameworkMessage(message)) {
      errors = errors ?? [message];
      message = undefined;
    }
    if (isFrameworkDefault) message = undefined;

    return {
      statusCode,
      code: code ?? errorCodeFromStatus(statusCode),
      message: message ?? defaultMessageFromStatus(statusCode),
      ...(errors && { errors }),
    };
  }

  private isFrameworkMessage(message: string): boolean {
    return /^(Cannot (GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS) |Validation failed|Unexpected token|Bad Request$|Unauthorized$|Not Found$|Forbidden$|Internal Server Error$|ThrottlerException|Too Many Requests|request entity too large|Payload Too Large)/i.test(
      message,
    ) || /in JSON at position/.test(message);
  }

  private fromPrismaKnownError(
    exception: Prisma.PrismaClientKnownRequestError,
  ): ResolvedError {
    if (PRISMA_CONNECTION_CODES.has(exception.code)) {
      return {
        statusCode: HttpStatus.SERVICE_UNAVAILABLE,
        code: ErrorCode.DATABASE_UNAVAILABLE,
        message: DATABASE_UNAVAILABLE_MESSAGE,
      };
    }
    switch (exception.code) {
      // violación de unicidad: alguien más creó el mismo recurso
      case 'P2002':
        return {
          statusCode: HttpStatus.CONFLICT,
          code: ErrorCode.CONFLICT,
          message: 'El registro ya existe',
        };
      // violación de llave foránea: el recurso referenciado no existe o sigue en uso
      case 'P2003':
        return {
          statusCode: HttpStatus.CONFLICT,
          code: ErrorCode.CONFLICT,
          message: defaultMessageFromStatus(HttpStatus.CONFLICT),
        };
      // la fila a actualizar/borrar no existe
      case 'P2025':
        return {
          statusCode: HttpStatus.NOT_FOUND,
          code: ErrorCode.NOT_FOUND,
          message: defaultMessageFromStatus(HttpStatus.NOT_FOUND),
        };
      default:
        return {
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          code: ErrorCode.INTERNAL_ERROR,
          message: defaultMessageFromStatus(HttpStatus.INTERNAL_SERVER_ERROR),
        };
    }
  }

  // 5xx: error con stack (algo se rompió). 401/404: debug (tráfico normal: sesión vencida, ids
  // ajenos). Resto de 4xx: warn sin stack. Un error de Prisma se loguea siempre con su código, aunque
  // se responda 4xx: no debería llegar hasta acá.
  private log(
    exception: unknown,
    resolved: ResolvedError,
    request: { url?: string; method?: string; requestId?: string } | undefined,
  ): void {
    const context = {
      requestId: request?.requestId,
      method: request?.method,
      path: request?.url,
      status: resolved.statusCode,
      code: resolved.code,
      message: resolved.message,
      ...(resolved.errors && { errors: resolved.errors }),
    };
    const isHttpException = exception instanceof HttpException;
    const error = exception instanceof Error ? exception : undefined;

    const isUnexpected =
      !isHttpException &&
      (resolved.statusCode >= 500 ||
        exception instanceof Prisma.PrismaClientKnownRequestError);
    if (resolved.statusCode >= 500 || isUnexpected) {
      this.logger.error(
        {
          ...context,
          cause: error ? `${error.name}: ${error.message}` : String(exception),
          ...(exception instanceof Prisma.PrismaClientKnownRequestError && {
            prismaCode: exception.code,
            prismaMeta: exception.meta,
          }),
        },
        error?.stack,
      );
      return;
    }
    if (
      resolved.statusCode === HttpStatus.UNAUTHORIZED ||
      resolved.statusCode === HttpStatus.NOT_FOUND
    ) {
      this.logger.debug(context);
      return;
    }
    this.logger.warn(context);
  }
}
